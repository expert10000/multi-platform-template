import type { KpiSummary, SalesCsvRow } from "./models.js";

export function calculateSalesKpis(rows: SalesCsvRow[]): KpiSummary {
  const totals = rows.reduce(
    (acc, row) => {
      acc.revenue += Number(row.revenue) || 0;
      acc.cost += Number(row.cost) || 0;
      return acc;
    },
    { revenue: 0, cost: 0 }
  );

  const profit = totals.revenue - totals.cost;
  const margin = totals.revenue === 0 ? 0 : profit / totals.revenue;
  const growth = calculateSimpleGrowth(rows.map((row) => Number(row.revenue) || 0));

  return {
    revenue: totals.revenue,
    cost: totals.cost,
    profit,
    margin,
    growth
  };
}

export function calculateSimpleGrowth(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const first = values[0];
  const last = values[values.length - 1];
  return first === 0 ? 0 : (last - first) / first;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1
  }).format(value);
}
