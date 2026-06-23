# Real Sample Data

These files are extracted from user-provided archives and are intentionally kept separate from the small toy CSVs.

## Online Retail

Path:

```text
sample-data/real/online-retail/Online Retail.xlsx
```

Shape:

- 541,909 data rows
- transaction-level retail data
- key columns: `InvoiceNo`, `StockCode`, `Description`, `Quantity`, `InvoiceDate`, `UnitPrice`, `CustomerID`, `Country`

Worker mapping:

- `InvoiceDate` -> date
- `Country` -> region
- `Quantity * UnitPrice` -> revenue
- cost defaults to `0` because the source does not include cost

## Superstore Sales

Path:

```text
sample-data/real/superstore-sales/train.csv
```

Shape:

- 9,800 data rows
- order-level sales data
- key columns: `Order Date`, `Region`, `Category`, `Sub-Category`, `Product Name`, `Sales`

Worker mapping:

- `Order Date` -> date
- `Region` -> region
- `Sales` -> revenue
- cost defaults to `0` unless a `Profit` column is available
