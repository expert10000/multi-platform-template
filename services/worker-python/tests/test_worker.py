from pathlib import Path

from service.main import analyze_kpis, load_sales_csv


def test_analyze_kpis_from_sample_data():
    data = load_sales_csv(Path("sample-data/online-retail.csv"))
    result = analyze_kpis(data)

    assert result["revenue"] > 0
    assert result["profit"] > 0
    assert 0 < result["margin"] < 1
