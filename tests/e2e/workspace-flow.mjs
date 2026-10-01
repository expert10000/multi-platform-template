import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");
const workspaceRoot = join(repoRoot, ".workspace");
const testDir = join(workspaceRoot, `e2e-${randomUUID()}`);
const databasePath = join(testDir, "workspace.sqlite3");
const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const createdFiles = [];
await mkdir(testDir, { recursive: true });

const server = spawn(process.execPath, [join(repoRoot, "services/workspace-server/dist/server.js")], {
  cwd: repoRoot,
  env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), WORKSPACE_DB_PATH: databasePath },
  windowsHide: true,
  stdio: "ignore"
});

async function request(path, method = "GET", body) {
  const response = await fetch(`${base}${path}`, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${JSON.stringify(payload)}`);
  return payload;
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { await request("/health"); ready = true; break; } catch { await new Promise((resolveDelay) => setTimeout(resolveDelay, 150)); }
  }
  assert(ready, "Workspace Server did not start.");

  const content = await readFile(join(repoRoot, "data/sample/online-retail.csv"), "utf8");
  const dataset = await request("/api/datasets", "POST", { filename: "e2e-sales.csv", content });
  assert.equal(dataset.rowCount, 8);
  createdFiles.push(resolve(repoRoot, dataset.sourcePath));

  const job = await request("/api/worker/jobs", "POST", { id: randomUUID(), kind: "sales.kpi", runtime: "python", requestedAt: new Date().toISOString(), params: { datasetId: dataset.id } });
  assert.equal(job.status, "queued");
  let state = job;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    state = await request(`/api/jobs/${job.id}`);
    if (state.status === "succeeded" || state.status === "failed") break;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  assert.equal(state.status, "succeeded", state.errorMessage ?? "Worker did not finish.");
  createdFiles.push(resolve(repoRoot, state.resultPath));
  const report = await request(`/api/reports/report-${job.id}/content`);
  assert.equal(report.revenue, 164500);
  assert.equal(report.profit, 60800);

  const trendJob = await request("/api/worker/jobs", "POST", { id: randomUUID(), kind: "sales.forecast", runtime: "python", requestedAt: new Date().toISOString(), params: { datasetId: dataset.id } });
  let trendState = trendJob;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    trendState = await request(`/api/jobs/${trendJob.id}`);
    if (trendState.status === "succeeded" || trendState.status === "failed") break;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  assert.equal(trendState.status, "succeeded", trendState.errorMessage ?? "Trend worker did not finish.");
  createdFiles.push(resolve(repoRoot, trendState.resultPath));
  const trend = await request(`/api/reports/report-${trendJob.id}/content`);
  assert.equal(trend.forecast.length, 3);

  const htmlJob = await request("/api/worker/jobs", "POST", { id: randomUUID(), kind: "report.html", runtime: "python", requestedAt: new Date().toISOString(), params: { datasetId: dataset.id } });
  let htmlState = htmlJob;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    htmlState = await request(`/api/jobs/${htmlJob.id}`);
    if (htmlState.status === "succeeded" || htmlState.status === "failed") break;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  assert.equal(htmlState.status, "succeeded", htmlState.errorMessage ?? "HTML worker did not finish.");
  createdFiles.push(resolve(repoRoot, htmlState.resultPath));
  const htmlResponse = await fetch(`${base}/api/reports/report-${htmlJob.id}/content`);
  assert.equal(htmlResponse.status, 200);
  assert.match(await htmlResponse.text(), /Executive Analytics Summary/);

  const missingDataset = await request("/api/datasets", "POST", { filename: "missing-sales.csv", content });
  const missingPath = resolve(repoRoot, missingDataset.sourcePath);
  await unlink(missingPath);
  const failedJob = await request("/api/worker/jobs", "POST", { id: randomUUID(), kind: "sales.kpi", runtime: "python", requestedAt: new Date().toISOString(), params: { datasetId: missingDataset.id } });
  let failedState = failedJob;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    failedState = await request(`/api/jobs/${failedJob.id}`);
    if (failedState.status === "failed") break;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  assert.equal(failedState.status, "failed");
  assert.match(failedState.errorMessage, /Dataset file is missing/);

  console.log("CSV import → KPI, trend, and HTML jobs → reports, including failed-job state, passed.");
} finally {
  if (server.exitCode === null) {
    server.kill();
    await new Promise((resolveClose) => server.once("close", resolveClose));
  }
  for (const path of createdFiles) {
    const rel = relative(workspaceRoot, path);
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) await unlink(path).catch(() => {});
  }
  const relDir = relative(workspaceRoot, testDir);
  if (relDir.startsWith("e2e-") && !relDir.includes("..")) await rm(testDir, { recursive: true, force: true });
}
