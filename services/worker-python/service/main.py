from __future__ import annotations

import argparse
import html
import json
from pathlib import Path
from typing import Any

import pandas as pd


def load_sales_csv(path: Path) -> pd.DataFrame:
    return load_sales_table(path)


def load_sales_table(path: Path) -> pd.DataFrame:
    if path.suffix.lower() in {".xlsx", ".xls"}:
        data = pd.read_excel(path)
    else:
        data = pd.read_csv(path)

    return normalize_sales_table(data)


def normalize_sales_table(data: pd.DataFrame) -> pd.DataFrame:
    lower_columns = {str(column).strip().lower(): column for column in data.columns}

    if {"date", "region", "revenue", "cost"}.issubset(lower_columns):
        normalized = pd.DataFrame(
            {
                "date": data[lower_columns["date"]],
                "region": data[lower_columns["region"]],
                "revenue": data[lower_columns["revenue"]],
                "cost": data[lower_columns["cost"]],
            }
        )
    elif {"invoicedate", "country", "quantity", "unitprice"}.issubset(lower_columns):
        quantity = pd.to_numeric(data[lower_columns["quantity"]], errors="coerce").fillna(0)
        unit_price = pd.to_numeric(data[lower_columns["unitprice"]], errors="coerce").fillna(0)
        normalized = pd.DataFrame(
            {
                "date": parse_date_series(data[lower_columns["invoicedate"]]),
                "region": data[lower_columns["country"]].fillna("Unknown"),
                "revenue": quantity * unit_price,
                "cost": 0,
            }
        )
    elif {"order date", "region", "sales"}.issubset(lower_columns):
        revenue = pd.to_numeric(data[lower_columns["sales"]], errors="coerce").fillna(0)
        profit_column = lower_columns.get("profit")
        profit = pd.to_numeric(data[profit_column], errors="coerce").fillna(0) if profit_column else revenue
        normalized = pd.DataFrame(
            {
                "date": parse_date_series(data[lower_columns["order date"]]),
                "region": data[lower_columns["region"]].fillna("Unknown"),
                "revenue": revenue,
                "cost": revenue - profit,
            }
        )
    else:
        raise ValueError(
            "Unsupported sales table. Expected columns for one of: "
            "date/region/revenue/cost, InvoiceDate/Country/Quantity/UnitPrice, "
            "or Order Date/Region/Sales."
        )

    normalized["date"] = parse_date_series(normalized["date"])
    normalized["revenue"] = pd.to_numeric(normalized["revenue"], errors="coerce").fillna(0)
    normalized["cost"] = pd.to_numeric(normalized["cost"], errors="coerce").fillna(0)
    normalized = normalized.dropna(subset=["date"])
    return normalized.sort_values("date")


def parse_date_series(values: pd.Series) -> pd.Series:
    if pd.api.types.is_datetime64_any_dtype(values):
        return pd.to_datetime(values, errors="coerce")

    numeric = pd.to_numeric(values, errors="coerce")
    if numeric.notna().mean() > 0.8:
        return pd.to_datetime(numeric, unit="D", origin="1899-12-30", errors="coerce")
    return pd.to_datetime(values, dayfirst=True, errors="coerce")


def analyze_kpis(data: pd.DataFrame) -> dict[str, Any]:
    revenue = float(data["revenue"].sum())
    cost = float(data["cost"].sum())
    profit = revenue - cost
    margin = profit / revenue if revenue else 0.0

    by_day = data.groupby("date", as_index=False)["revenue"].sum().sort_values("date")
    first = float(by_day.iloc[0]["revenue"]) if len(by_day) else 0.0
    last = float(by_day.iloc[-1]["revenue"]) if len(by_day) else 0.0
    growth = ((last - first) / first) if first else 0.0

    return {
        "revenue": round(revenue, 2),
        "cost": round(cost, 2),
        "profit": round(profit, 2),
        "margin": round(margin, 4),
        "growth": round(growth, 4),
        "regionBreakdown": data.groupby("region")["revenue"].sum().round(2).to_dict(),
    }


def analyze_trend(data: pd.DataFrame) -> dict[str, Any]:
    by_day = data.groupby("date", as_index=False)["revenue"].sum().sort_values("date")
    by_day["movingAverage"] = by_day["revenue"].rolling(window=3, min_periods=1).mean()

    latest_average = float(by_day.iloc[-1]["movingAverage"]) if len(by_day) else 0.0
    forecast = [
        {"period": f"forecast-{index + 1}", "revenue": round(latest_average * (1 + 0.025 * (index + 1)), 2)}
        for index in range(3)
    ]

    return {
        "series": [
            {
                "date": row["date"].strftime("%Y-%m-%d"),
                "revenue": round(float(row["revenue"]), 2),
                "movingAverage": round(float(row["movingAverage"]), 2),
            }
            for _, row in by_day.iterrows()
        ],
        "forecast": forecast,
    }


def build_recommendations(kpis: dict[str, Any]) -> list[str]:
    recommendations = []
    if kpis["margin"] < 0.3:
        recommendations.append("Review discounting and cost drivers in low-margin regions.")
    else:
        recommendations.append("Protect margin by keeping cost controls tied to revenue growth.")

    if kpis["growth"] < 0.05:
        recommendations.append("Prioritize demand generation in regions with flat sales.")
    else:
        recommendations.append("Use the current growth trend to expand forecast confidence bands.")

    recommendations.append("Schedule weekly KPI analysis jobs for newly imported sales CSV files.")
    return recommendations


def render_html_report(data: pd.DataFrame) -> str:
    kpis = analyze_kpis(data)
    trend = analyze_trend(data)
    recommendations = build_recommendations(kpis)
    trend_rows = "\n".join(
        f"<tr><td>{html.escape(point['date'])}</td><td>{point['revenue']}</td><td>{point['movingAverage']}</td></tr>"
        for point in trend["series"]
    )
    recommendation_rows = "\n".join(
        f"<li>{html.escape(recommendation)}</li>"
        for recommendation in recommendations
    )

    return f"""
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Executive Analytics Summary</title>
    <style>
      body {{ font-family: Arial, sans-serif; margin: 40px; color: #17202a; }}
      h1 {{ margin-bottom: 4px; }}
      .muted {{ color: #637067; }}
      table {{ border-collapse: collapse; width: 100%; margin: 24px 0; }}
      th, td {{ border-bottom: 1px solid #dfe5df; padding: 10px; text-align: left; }}
      th {{ color: #637067; text-transform: uppercase; font-size: 12px; }}
      .grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }}
      .card {{ border: 1px solid #dfe5df; padding: 16px; border-radius: 8px; }}
      .value {{ display: block; font-size: 24px; font-weight: 700; }}
    </style>
  </head>
  <body>
    <h1>Executive Analytics Summary</h1>
    <p class="muted">Generated from imported CSV business data.</p>
    <section class="grid">
      <div class="card"><span>Revenue</span><span class="value">${kpis['revenue']:,.0f}</span></div>
      <div class="card"><span>Profit</span><span class="value">${kpis['profit']:,.0f}</span></div>
      <div class="card"><span>Margin</span><span class="value">{kpis['margin']:.1%}</span></div>
      <div class="card"><span>Growth</span><span class="value">{kpis['growth']:.1%}</span></div>
    </section>
    <h2>Trend</h2>
    <table>
      <thead><tr><th>Date</th><th>Revenue</th><th>Moving Average</th></tr></thead>
      <tbody>
        {trend_rows}
      </tbody>
    </table>
    <h2>Recommendations</h2>
    <ul>
      {recommendation_rows}
    </ul>
  </body>
</html>
    """


def write_output(output_path: Path, payload: dict[str, Any] | str) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(payload, str):
        output_path.write_text(payload, encoding="utf-8")
        return

    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Enterprise analytics CSV worker")
    parser.add_argument("--job", choices=["kpi", "trend", "report"], required=True)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    data = load_sales_table(Path(args.input))
    if args.job == "kpi":
        payload: dict[str, Any] | str = analyze_kpis(data)
    elif args.job == "trend":
        payload = analyze_trend(data)
    else:
        payload = render_html_report(data)

    write_output(Path(args.output), payload)
    print(json.dumps({"ok": True, "job": args.job, "output": args.output}))


if __name__ == "__main__":
    main()
