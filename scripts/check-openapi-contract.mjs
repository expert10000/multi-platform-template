import { readFile } from "node:fs/promises";

const specPath = new URL("../packages/contracts/openapi.json", import.meta.url);
const examplePath = new URL("../packages/contracts/examples/dashboard-snapshot.json", import.meta.url);
const tsModelsPath = new URL("../packages/domain/src/models.ts", import.meta.url);
const csModelsPath = new URL("../apps/maui/Contracts/DashboardContracts.cs", import.meta.url);

const spec = JSON.parse(await readFile(specPath, "utf8"));
const example = JSON.parse(await readFile(examplePath, "utf8"));
const tsModels = await readFile(tsModelsPath, "utf8");
const csModels = await readFile(csModelsPath, "utf8");

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

for (const [path, method] of [["/worker/jobs", "post"], ["/datasets", "post"], ["/jobs/{id}", "get"], ["/reports/{id}/content", "get"]]) {
  if (!spec.paths?.[path]?.[method]) throw new Error(`Missing ${method.toUpperCase()} ${path} operation.`);
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

function validateObject(schemaName, value, label) {
  const schema = spec.components.schemas[schemaName];
  for (const field of schema.required ?? []) {
    if (!(field in value)) throw new Error(`${label} is missing ${field} required by ${schemaName}.`);
  }
  for (const [field, property] of Object.entries(schema.properties ?? {})) {
    if (!(field in value) || value[field] === null) continue;
    const ref = property.$ref?.split("/").at(-1);
    if (ref && spec.components.schemas[ref]?.type === "object") validateObject(ref, value[field], `${label}.${field}`);
    if (property.type === "array" && !Array.isArray(value[field])) throw new Error(`${label}.${field} must be an array.`);
    const itemRef = property.items?.$ref?.split("/").at(-1);
    if (itemRef && Array.isArray(value[field])) value[field].forEach((item, index) => validateObject(itemRef, item, `${label}.${field}[${index}]`));
  }
}
validateObject("DashboardSnapshot", example, "dashboard example");

for (const [schemaName, csName] of [["DashboardSnapshot", "DashboardSnapshot"], ["Project", "ProjectDto"], ["Dataset", "DatasetDto"], ["Job", "JobDto"], ["Report", "ReportDto"]]) {
  const tsBody = new RegExp(`export interface ${schemaName} \\{([\\s\\S]*?)\\n\\}`).exec(tsModels)?.[1];
  const csBody = new RegExp(`public sealed record ${csName}\\(([\\s\\S]*?)\\);`).exec(csModels)?.[1];
  if (!tsBody || !csBody) throw new Error(`Missing TypeScript or C# model for ${schemaName}.`);
  for (const field of Object.keys(spec.components.schemas[schemaName].properties ?? {})) {
    if (!new RegExp(`\\b${field}\\??:`).test(tsBody)) throw new Error(`TypeScript ${schemaName} is missing ${field}.`);
    const csField = field[0].toUpperCase() + field.slice(1);
    if (!new RegExp(`\\b${csField}\\b`).test(csBody)) throw new Error(`C# ${csName} is missing ${csField}.`);
  }
}

console.log("OpenAPI routes, example payload, and TypeScript/C# DTO fields are in sync.");
