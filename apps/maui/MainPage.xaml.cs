using System.ComponentModel;
using System.Globalization;
using EnterpriseAnalytics.Maui.Contracts;
using EnterpriseAnalytics.Maui.Services;

namespace EnterpriseAnalytics.Maui;

public partial class MainPage : ContentPage, INotifyPropertyChanged
{
	private readonly DashboardSnapshotProvider dashboardProvider = new();
	private IReadOnlyList<MetricCard> metrics = [];
	private IReadOnlyList<ActivityItem> activity = [];

	public string ProjectCount { get; private set; } = "--";
	public string DatasetCount { get; private set; } = "--";
	public string JobCount { get; private set; } = "--";
	public string ReportCount { get; private set; } = "--";
	public string StatusText { get; private set; } = "Starting API";
	public Color StatusBackgroundColor { get; private set; } = Color.FromArgb("#FFE2A8");
	public Color StatusTextColor { get; private set; } = Color.FromArgb("#5C3A00");

	public IReadOnlyList<MetricCard> Metrics
	{
		get => metrics;
		private set
		{
			metrics = value;
			OnPropertyChanged();
		}
	}

	public IReadOnlyList<ActivityItem> Activity
	{
		get => activity;
		private set
		{
			activity = value;
			OnPropertyChanged();
		}
	}

	public MainPage()
	{
		InitializeComponent();
		BindingContext = this;
	}

	protected override async void OnAppearing()
	{
		base.OnAppearing();
		await LoadDashboardAsync();
	}

	private async Task LoadDashboardAsync()
	{
		try
		{
			var result = await dashboardProvider.GetDashboardSnapshotAsync();
			ApplySnapshot(result);
		}
		catch (Exception ex)
		{
			Activity =
			[
				new("Contract data unavailable", ex.Message)
			];
		}
	}

	private void ApplySnapshot(DashboardSnapshotLoadResult result)
	{
		var snapshot = result.Snapshot;
		StatusText = result.StatusText;
		StatusBackgroundColor = result.StatusBackgroundColor;
		StatusTextColor = result.StatusTextColor;
		ProjectCount = snapshot.Counts.Projects.ToString(CultureInfo.InvariantCulture);
		DatasetCount = snapshot.Counts.Datasets.ToString(CultureInfo.InvariantCulture);
		JobCount = snapshot.Counts.Jobs.ToString(CultureInfo.InvariantCulture);
		ReportCount = snapshot.Counts.Reports.ToString(CultureInfo.InvariantCulture);

		OnPropertyChanged(nameof(StatusText));
		OnPropertyChanged(nameof(StatusBackgroundColor));
		OnPropertyChanged(nameof(StatusTextColor));
		OnPropertyChanged(nameof(ProjectCount));
		OnPropertyChanged(nameof(DatasetCount));
		OnPropertyChanged(nameof(JobCount));
		OnPropertyChanged(nameof(ReportCount));

		Metrics =
		[
			new("Revenue", FormatCurrency(snapshot.Kpis.Revenue), FormatPercent(snapshot.Kpis.Growth)),
			new("Profit", FormatCurrency(snapshot.Kpis.Profit), FormatPercent(snapshot.Kpis.Margin)),
			new("Cost", FormatCurrency(snapshot.Kpis.Cost), "tracked")
		];

		Activity =
		[
			.. snapshot.RecentDatasets.Take(2).Select(dataset =>
				new ActivityItem($"{dataset.Name} imported", $"{dataset.RowCount:N0} rows registered from {dataset.SourcePath}.")),
			.. snapshot.RecentJobs.Take(2).Select(job =>
				new ActivityItem($"{FormatKind(job.Kind)} {job.Status}", $"Dataset {job.DatasetId} handled by {job.RequestedBy}.")),
			.. snapshot.RecentReports.Take(1).Select(report =>
				new ActivityItem($"{report.Title} ready", report.OutputPath))
		];
	}

	private static string FormatCurrency(decimal value) =>
		string.Create(CultureInfo.InvariantCulture, $"{value:C0}");

	private static string FormatPercent(decimal value) =>
		string.Create(CultureInfo.InvariantCulture, $"{value:P1}");

	private static string FormatKind(string value) =>
		CultureInfo.InvariantCulture.TextInfo.ToTitleCase(value.Replace("-", " "));
}

public sealed record MetricCard(string Label, string Value, string Delta);

public sealed record ActivityItem(string Title, string Detail);
