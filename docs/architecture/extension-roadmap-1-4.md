# Extension roadmap (1–4)

This document records the four extension areas frozen on branch `1-4`. Branch `codex/implement-1-4` implements the example workflow and host integrations described below while retaining the existing repository layout. See the README for the current run and test instructions.

## First implementation slice

Import a CSV dataset in React Web, submit a KPI analysis job through the Workspace Server, follow its progress, and open the resulting report. The same flow also supports trend analysis and HTML report generation through the Python worker. The Node worker retains its command-line entry points.

## 1. Dashboard interactions

- Make the search field filter projects, datasets, and jobs.
- Let the project, dataset, job, and report cards open their corresponding views.
- Connect the Import Data, Run Job, and Generate actions to working flows, with clear loading, success, and error states.

## 2. Job progress and results

- Persist job status and results in the shared workspace repository.
- Show queued, running, completed, and failed jobs in React Web.
- Link completed jobs to their generated reports and explain failures in the job view.

## 3. Host parity

- Connect the Expo/React Native starter to the Workspace Server instead of relying only on bundled demo data.
- Exercise the import → job → report flow in Electron and the .NET MAUI native dashboard where each host supports it.
- Keep host-specific UI separate while sharing the existing HTTP/OpenAPI contract and domain model.

## 4. Template readiness

- Generate or validate TypeScript and C# clients from the shared OpenAPI contract so the hosts stay in sync.
- Review Electron's renderer isolation, permissions, and navigation before distributing desktop builds.
- Document and test the complete example workflow for someone using the template for the first time.

Use the existing `apps`, `packages`, `services`, `data`, `docs`, `docker`, `scripts`, and `tests` directories. Do not move or rename the established hosts, contracts, workers, or sample data as part of this roadmap.
