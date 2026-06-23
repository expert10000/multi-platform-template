import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export interface MetricCardProps {
  label: string;
  value: string;
  detail?: string;
  trend?: "up" | "down" | "neutral";
}

export function MetricCard({ label, value, detail, trend = "neutral" }: MetricCardProps) {
  const TrendIcon = trend === "down" ? ArrowDownRight : ArrowUpRight;

  return (
    <section className="metric-card">
      <div>
        <span className="metric-card__label">{label}</span>
        <strong className="metric-card__value">{value}</strong>
      </div>
      {detail ? (
        <span className={`metric-card__detail metric-card__detail--${trend}`}>
          {trend !== "neutral" ? <TrendIcon aria-hidden="true" size={16} /> : null}
          {detail}
        </span>
      ) : null}
    </section>
  );
}

export interface DataTableProps {
  columns: string[];
  rows: Array<Array<ReactNode>>;
}

export function DataTable({ columns, rows }: DataTableProps) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "good" | "busy" | "bad" | "neutral" }) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>;
}
