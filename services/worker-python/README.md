# Python Worker

The worker processes business CSV files and writes analysis outputs for the workspace.

Supported jobs:

- `kpi` - revenue, cost, profit, margin, and growth.
- `trend` - moving average and simple forecast over sales revenue.
- `report` - executive HTML summary with KPI table and recommendations.

Run examples from the repository root:

```bash
python services/worker-python/service/main.py --job kpi --input sample-data/online-retail.csv --output reports/kpi-analysis.json
python services/worker-python/service/main.py --job trend --input sample-data/superstore-sales.csv --output reports/trend-analysis.json
python services/worker-python/service/main.py --job report --input sample-data/online-retail.csv --output reports/executive-summary.html
python services/worker-python/service/main.py --job kpi --input sample-data/real/superstore-sales/train.csv --output reports/superstore-kpi-analysis.json
python services/worker-python/service/main.py --job kpi --input "sample-data/real/online-retail/Online Retail.xlsx" --output reports/online-retail-kpi-analysis.json
```

Supported sales schemas:

- `date,region,revenue,cost`
- `InvoiceDate,Country,Quantity,UnitPrice`
- `Order Date,Region,Sales`

Install Python dependencies:

```bash
python -m pip install -r services/worker-python/requirements.txt
```
