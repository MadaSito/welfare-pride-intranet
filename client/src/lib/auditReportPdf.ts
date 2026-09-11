import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";

type AnalyticsRow = { eventType: string; label: string; count: number };
type AuditRow = { entityType: string; eventType: string; status: string; message: string; createdAt: Date | string; actorUserId: number | null; entityId: number | null };

type ReportInput = {
  windowDays: number;
  administrativeActions: AnalyticsRow[];
  configurationChanges: AnalyticsRow[];
  records: AuditRow[];
  filters: { query?: string; entityType?: string; eventType?: string; status?: string };
};

const blue: [number, number, number] = [90, 146, 201];
const orange: [number, number, number] = [213, 130, 64];
const dark: [number, number, number] = [32, 47, 63];

function pageFooter(doc: jsPDF) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...blue);
  doc.line(14, height - 12, width - 14, height - 12);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text("Welfare Pride • System Audit Center • Management review", 14, height - 7);
  doc.text(`Page ${doc.getNumberOfPages()}`, width - 14, height - 7, { align: "right" });
}

function chartHeight(rows: AnalyticsRow[]) { return Math.max(44, rows.length * 12 + 16); }

function drawBars(doc: jsPDF, title: string, rows: AnalyticsRow[], y: number, color: [number, number, number]) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 20;
  const labelWidth = 62;
  const chartWidth = pageWidth - left - labelWidth - 28;
  const max = Math.max(1, ...rows.map(row => row.count));
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (!rows.length) {
    doc.setTextColor(100, 116, 139);
    doc.text("No retained activity in this reporting period.", left, y + 12);
    return y + 24;
  }
  let cursor = y + 9;
  rows.forEach(row => {
    const barWidth = Math.max(2, (row.count / max) * chartWidth);
    doc.setTextColor(71, 85, 105);
    const label = row.label.length > 28 ? `${row.label.slice(0, 27)}…` : row.label;
    doc.text(label, left, cursor + 3, { maxWidth: labelWidth - 4 });
    doc.setFillColor(229, 236, 244);
    doc.roundedRect(left + labelWidth, cursor - 2, chartWidth, 6, 1.5, 1.5, "F");
    doc.setFillColor(...color);
    doc.roundedRect(left + labelWidth, cursor - 2, barWidth, 6, 1.5, 1.5, "F");
    doc.setTextColor(...dark);
    doc.text(String(row.count), left + labelWidth + chartWidth + 4, cursor + 3);
    cursor += 12;
  });
  return cursor + 6;
}

export function downloadAuditManagementReport(input: ReportInput) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date();
  const start = new Date(now.getTime() - (input.windowDays - 1) * 24 * 60 * 60 * 1000);
  const totalActions = input.administrativeActions.reduce((sum, item) => sum + item.count, 0);
  const totalConfigurations = input.configurationChanges.reduce((sum, item) => sum + item.count, 0);
  const activeFilters = [input.filters.query && `Search: ${input.filters.query}`, input.filters.entityType && `Entity: ${input.filters.entityType}`, input.filters.eventType && `Action: ${input.filters.eventType}`, input.filters.status && `Outcome: ${input.filters.status}`].filter(Boolean) as string[];

  doc.setFillColor(...blue);
  doc.rect(0, 0, pageWidth, 31, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("Welfare Pride", 14, 14);
  doc.setFontSize(12);
  doc.text("System Audit Center — Management Report", 14, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generated ${now.toLocaleString()} • Reporting window ${start.toLocaleDateString()}–${now.toLocaleDateString()}`, 14, 27);

  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Executive summary", 14, 41);
  autoTable(doc, {
    startY: 45,
    theme: "grid",
    head: [["Reporting period", "Administrative actions", "Configuration changes", "Filtered timeline records"]],
    body: [[`${input.windowDays} days`, String(totalActions), String(totalConfigurations), String(input.records.length)]],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: blue, textColor: 255 },
  });
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8);
  doc.text(activeFilters.length ? `Timeline filters: ${activeFilters.join(" • ")}` : "Timeline filters: none (all retained action records shown)", 14, y, { maxWidth: pageWidth - 28 });
  y += 9;
  y = drawBars(doc, "Frequent administrative actions", input.administrativeActions, y, blue);
  y = drawBars(doc, "Configuration changes", input.configurationChanges, y + 3, orange);

  doc.addPage();
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Audit data appendix", 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`The table includes the first ${Math.min(300, input.records.length)} records matching the active timeline filters.`, 14, 24);
  autoTable(doc, {
    startY: 29,
    theme: "grid",
    head: [["Timestamp", "Entity", "Action", "Outcome", "Change description"]],
    body: input.records.slice(0, 300).map(row => [new Date(row.createdAt).toLocaleString(), row.entityType.replaceAll("_", " "), row.eventType.replaceAll("_", " "), row.status, row.message]),
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: blue, textColor: 255 },
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 24 }, 2: { cellWidth: 30 }, 3: { cellWidth: 21 }, 4: { cellWidth: 74 } },
    didDrawPage: () => pageFooter(doc),
  });
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    pageFooter(doc);
  }
  const dateStamp = now.toISOString().slice(0, 10);
  doc.save(`welfare-pride-system-audit-${dateStamp}.pdf`);
}
