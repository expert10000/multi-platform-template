import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

export interface CsvReadOptions {
  maxPreviewRows?: number;
}

export interface CsvTablePreview {
  columns: string[];
  rowCount: number;
  previewRows: Record<string, string>[];
}

export async function readCsvPreview(path: string, options: CsvReadOptions = {}): Promise<CsvTablePreview> {
  const maxPreviewRows = options.maxPreviewRows ?? 5;
  const reader = createInterface({
    crlfDelay: Infinity,
    input: createReadStream(path, { encoding: "utf-8" })
  });

  let columns: string[] = [];
  let rowCount = 0;
  const previewRows: Record<string, string>[] = [];

  for await (const line of reader) {
    if (!line.trim()) {
      continue;
    }

    const values = parseCsvLine(line);
    if (columns.length === 0) {
      columns = values;
      continue;
    }

    rowCount += 1;
    if (previewRows.length < maxPreviewRows) {
      previewRows.push(Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ""])));
    }
  }

  return { columns, rowCount, previewRows };
}

export function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      value += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }

  values.push(value);
  return values;
}
