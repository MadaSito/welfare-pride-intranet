const port = process.env.PORT || "3000";
try {
  const response = await fetch(`http://127.0.0.1:${port}/api/healthz`, { signal: AbortSignal.timeout(4_000) });
  if (!response.ok) throw new Error(`health endpoint returned ${response.status}`);
  const payload = await response.json();
  if (payload?.ok !== true) throw new Error("health endpoint returned an invalid payload");
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : "health check failed");
  process.exit(1);
}
