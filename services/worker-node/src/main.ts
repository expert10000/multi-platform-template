import { runNodeWorkerJob, readWorkerRequest } from "./jobs.js";

function getRequestPath() {
  const index = process.argv.indexOf("--request");
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const requestPath = getRequestPath();
if (!requestPath) {
  console.error("Usage: node dist/main.js --request <request.json>");
  process.exit(1);
}

const request = await readWorkerRequest(requestPath);
const result = await runNodeWorkerJob(request);
console.log(JSON.stringify(result, null, 2));

if (result.status === "failed") {
  process.exitCode = 1;
}
