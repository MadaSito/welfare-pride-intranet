import { copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(projectRoot, "scripts", "hostinger-entry.mjs");
const destination = path.join(projectRoot, "dist", "hostinger-entry.js");

await copyFile(source, destination);
console.log(`Staged Hostinger startup entry: ${path.relative(projectRoot, destination)}`);
