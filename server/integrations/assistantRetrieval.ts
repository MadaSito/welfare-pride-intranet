import * as db from "../db";
import { getAuthorizedSharePointDocumentText, listAuthorizedSharePointDocuments } from "./sharePoint";

export type AssistantSource = {
  id: string;
  type: "announcement" | "company" | "hr_document";
  title: string;
  url: string;
  content: string;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function relevance(value: string, query: string) {
  const haystack = normalize(value);
  const terms = Array.from(new Set(normalize(query).split(" ").filter(term => term.length > 2)));
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function truncate(value: string, limit: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

function notNull<T>(value: T | null): value is T {
  return value !== null;
}

export async function retrieveAssistantSources(userId: number, query: string) {
  const [announcements, about, founders, milestones, documentMatches] = await Promise.all([
    db.searchPublishedAnnouncements(query, 5),
    db.listPublishedContentBlocks("about"),
    db.listPublishedFounders(),
    db.listPublishedMilestones(),
    listAuthorizedSharePointDocuments({ userId, query }).catch(() => []),
  ]);

  const local: AssistantSource[] = [
    ...announcements.map(item => ({ id: `announcement:${item.id}`, type: "announcement" as const, title: item.title, url: `/announcements?announcement=${item.id}`, content: `${item.summary || ""}\n${item.body}` })),
    ...about.map(item => ({ id: `about:${item.id}`, type: "company" as const, title: item.title, url: "/about", content: `${item.eyebrow || ""}\n${item.body}` })),
    ...founders.map(item => ({ id: `founder:${item.id}`, type: "company" as const, title: item.name, url: "/founders", content: `${item.title || ""}\n${item.bio}` })),
    ...milestones.map(item => ({ id: `milestone:${item.id}`, type: "company" as const, title: item.title, url: "/founders", content: `${item.eventDate}\n${item.description}` })),
  ]
    .map(item => ({ item, score: relevance(`${item.title} ${item.content}`, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ item }) => ({ ...item, content: truncate(item.content, 5_000) }));

  const hrDocuments: AssistantSource[] = (await Promise.all(documentMatches.filter(item => !item.isFolder).slice(0, 4).map(async item => {
    try {
      const extracted = await getAuthorizedSharePointDocumentText({ userId, documentId: item.id });
      if (!extracted?.text) return null;
      return { id: `hr:${item.id}`, type: "hr_document" as const, title: item.name, url: item.webUrl, content: extracted.text };
    } catch {
      return null;
    }
  }))).filter(notNull);

  const sources = [...hrDocuments, ...local].slice(0, 8);
  let budget = 38_000;
  return sources.map(source => {
    const content = source.content.slice(0, Math.max(0, budget));
    budget -= content.length;
    return { ...source, content };
  }).filter(source => source.content.length > 0);
}
