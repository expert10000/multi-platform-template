import { readFile } from "node:fs/promises";

const specPath = new URL("../services/worker-api-contract/openapi.json", import.meta.url);
const examplePath = new URL("../services/worker-api-contract/examples/dashboard-snapshot.json", import.meta.url);

const spec = JSON.parse(await readFile(specPath, "utf8"));
const example = JSON.parse(await readFile(examplePath, "utf8"));

const requiredSchemas = [
  "DashboardSnapshot",
  "Project",
  "Dataset",
  "Job",
  "Report",
  "WorkerJobRequest",
  "WorkerJobResult"
];

for (const schemaName of requiredSchemas) {
  if (!spec.components?.schemas?.[schemaName]) {
    throw new Error(`Missing OpenAPI schema: ${schemaName}`);
  }
}

if (!spec.paths?.["/dashboard/snapshot"]?.get) {
  throw new Error("Missing GET /dashboard/snapshot operation.");
}

if (!spec.paths?.["/worker/jobs"]?.post) {
  throw new Error("Missing POST /worker/jobs operation.");
}

const dashboardFields = ["counts", "kpis", "recentProjects", "recentDatasets", "recentJobs", "recentReports"];
for (const field of dashboardFields) {
  if (!(field in example)) {
    throw new Error(`Dashboard example is missing ${field}.`);
  }
}

for (const field of ["recentProjects", "recentDatasets", "recentJobs", "recentReports"]) {
  if (!Array.isArray(example[field])) {
    throw new Error(`Dashboard example field ${field} must be an array.`);
  }
}

console.log("OpenAPI contract and dashboard example are readable.");
