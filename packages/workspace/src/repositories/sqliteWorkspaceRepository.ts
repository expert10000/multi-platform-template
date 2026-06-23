import type Database from "better-sqlite3";
import { demoDashboardSnapshot, type DashboardSnapshot, type Dataset, type Job, type Project, type Report, type User } from "@enterprise-analytics/core";

type CountRow = { count: number };

export class SqliteWorkspaceRepository {
  constructor(private readonly db: Database.Database) {}

  seedDemoWorkspace() {
    const tx = this.db.transaction(() => {
      this.upsertUser({
        id: "user-alex",
        displayName: "Alex Morgan",
        email: "alex@example.com",
        role: "admin",
        createdAt: "2026-06-23T00:00:00.000Z"
      });
      this.upsertUser({
        id: "user-morgan",
        displayName: "Morgan Lee",
        email: "morgan@example.com",
        role: "analyst",
        createdAt: "2026-06-23T00:00:00.000Z"
      });

      for (const project of demoDashboardSnapshot.recentProjects) {
        this.upsertProject(project);
      }
      for (const dataset of demoDashboardSnapshot.recentDatasets) {
        this.upsertDataset(dataset);
      }
      for (const job of demoDashboardSnapshot.recentJobs) {
        this.upsertJob(job);
      }
      for (const report of demoDashboardSnapshot.recentReports) {
        this.upsertReport(report);
      }
    });
    tx();
  }

  getDashboardSnapshot(): DashboardSnapshot {
    return {
      counts: {
        projects: this.count("projects"),
        datasets: this.count("datasets"),
        jobs: this.count("jobs"),
        reports: this.count("reports")
      },
      kpis: demoDashboardSnapshot.kpis,
      recentProjects: this.listProjects(),
      recentDatasets: this.listDatasets(),
      recentJobs: this.listJobs(),
      recentReports: this.listReports()
    };
  }

  upsertUser(user: User) {
    this.db.prepare(`
      INSERT INTO users (id, display_name, email, role, created_at)
      VALUES (@id, @displayName, @email, @role, @createdAt)
      ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        email = excluded.email,
        role = excluded.role
    `).run(user);
  }

  upsertProject(project: Project) {
    this.db.prepare(`
      INSERT INTO projects (id, name, description, owner_id, created_at, updated_at)
      VALUES (@id, @name, @description, @ownerId, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        updated_at = excluded.updated_at
    `).run(project);
  }

  upsertDataset(dataset: Dataset) {
    this.db.prepare(`
      INSERT INTO datasets (id, project_id, name, kind, source_path, row_count, imported_at)
      VALUES (@id, @projectId, @name, @kind, @sourcePath, @rowCount, @importedAt)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        kind = excluded.kind,
        source_path = excluded.source_path,
        row_count = excluded.row_count
    `).run(dataset);
  }

  upsertJob(job: Job) {
    this.db.prepare(`
      INSERT INTO jobs (id, project_id, dataset_id, kind, status, requested_by, created_at, completed_at)
      VALUES (@id, @projectId, @datasetId, @kind, @status, @requestedBy, @createdAt, @completedAt)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        completed_at = excluded.completed_at
    `).run({ ...job, completedAt: job.completedAt ?? null });
  }

  upsertReport(report: Report) {
    this.db.prepare(`
      INSERT INTO reports (id, project_id, job_id, title, format, output_path, created_at)
      VALUES (@id, @projectId, @jobId, @title, @format, @outputPath, @createdAt)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        format = excluded.format,
        output_path = excluded.output_path
    `).run(report);
  }

  listProjects(): Project[] {
    return this.db.prepare(`
      SELECT id, name, description, owner_id AS ownerId, created_at AS createdAt, updated_at AS updatedAt
      FROM projects
      ORDER BY updated_at DESC
      LIMIT 10
    `).all() as Project[];
  }

  listDatasets(): Dataset[] {
    return this.db.prepare(`
      SELECT id, project_id AS projectId, name, kind, source_path AS sourcePath, row_count AS rowCount, imported_at AS importedAt
      FROM datasets
      ORDER BY imported_at DESC
      LIMIT 10
    `).all() as Dataset[];
  }

  listJobs(): Job[] {
    return this.db.prepare(`
      SELECT id, project_id AS projectId, dataset_id AS datasetId, kind, status, requested_by AS requestedBy, created_at AS createdAt, completed_at AS completedAt
      FROM jobs
      ORDER BY created_at DESC
      LIMIT 10
    `).all() as Job[];
  }

  listReports(): Report[] {
    return this.db.prepare(`
      SELECT id, project_id AS projectId, job_id AS jobId, title, format, output_path AS outputPath, created_at AS createdAt
      FROM reports
      ORDER BY created_at DESC
      LIMIT 10
    `).all() as Report[];
  }

  private count(tableName: "projects" | "datasets" | "jobs" | "reports") {
    const row = this.db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as CountRow;
    return row.count;
  }
}
