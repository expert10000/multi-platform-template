import Database from "better-sqlite3";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { workspaceSchemaSql } from "./schema.js";

export function openWorkspaceDatabase(databasePath: string): Database.Database {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(workspaceSchemaSql);
  const jobColumns = db.prepare("PRAGMA table_info(jobs)").all() as Array<{ name: string }>;
  if (!jobColumns.some((column) => column.name === "error_message")) db.exec("ALTER TABLE jobs ADD COLUMN error_message TEXT");
  if (!jobColumns.some((column) => column.name === "result_path")) db.exec("ALTER TABLE jobs ADD COLUMN result_path TEXT");
  return db;
}
