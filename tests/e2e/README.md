# End-to-end workspace flow

Run `npm run test:flow` after installing the repository's Node and Python worker dependencies. The test starts an isolated Workspace Server and SQLite database, imports a CSV dataset, runs KPI and trend jobs, generates and reads an HTML report, and verifies that a missing input produces a failed job. It removes its test workspace afterward.

This exercises the HTTP contract, persistence, and Python worker together. Electron, Expo, and MAUI window behavior require separate host smoke checks.
