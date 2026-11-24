// Hostinger's Express preset defaults to this root-level entry filename.
// Keep the static graph synchronous for LiteSpeed's require() launcher; the
// built wrapper performs migrations before dynamically starting the server.
import("./dist/hostinger-entry.js").catch(() => {
  console.error("[Hostinger] Could not load the built startup entry. Run pnpm build and check the runtime logs.");
  process.exit(1);
});
