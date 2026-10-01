using System.ComponentModel;
using System.Globalization;
using System.Net.Http.Json;
using EnterpriseAnalytics.Maui.Contracts;
using EnterpriseAnalytics.Maui.Services;

namespace EnterpriseAnalytics.Maui;

public partial class MainPage : ContentPage, INotifyPropertyChanged
{
	private readonly DashboardSnapshotProvider dashboardProvider = new();
	private IReadOnlyList<MetricCard> metrics = [];
	private IReadOnlyList<ActivityItem> activity = [];
	private DashboardSnapshot? currentSnapshot;
	private const string ApiBaseUrl = "http://127.0.0.1:8797/api";
	private string actionMessage = "Use the local Workspace Server to import and analyze a sales CSV.";
	public string ActionMessage { get => actionMessage; private set { actionMessage = value; OnPropertyChanged(); } }

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
		currentSnapshot = snapshot;
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

	private async void OnRefreshClicked(object? sender, EventArgs e) => await LoadDashboardAsync();

	private async void OnImportClicked(object? sender, EventArgs e)
	{
		try
		{
			var file = await FilePicker.Default.PickAsync(new PickOptions { PickerTitle = "Choose a sales CSV" });
			if (file is null) return;
			if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)) { ActionMessage = "Choose a CSV file."; return; }
			await using var stream = await file.OpenReadAsync();
			using var reader = new StreamReader(stream);
			var content = await reader.ReadToEndAsync();
			using var client = new HttpClient();
			var response = await client.PostAsJsonAsync($"{ApiBaseUrl}/datasets", new { filename = file.FileName, content });
			if (!response.IsSuccessStatusCode) throw new InvalidOperationException(await response.Content.ReadAsStringAsync());
			ActionMessage = $"Imported {file.FileName}.";
			await LoadDashboardAsync();
		}
		catch (Exception ex) { ActionMessage = $"Import failed: {ex.Message}"; }
	}

	private async Task RunWorkerAsync(string kind)
	{
		var dataset = currentSnapshot?.RecentDatasets.FirstOrDefault(item => item.Kind == "sales" && item.SourcePath.StartsWith(".workspace/uploads/"))
			?? currentSnapshot?.RecentDatasets.FirstOrDefault(item => item.Kind == "sales");
		if (dataset is null) { ActionMessage = "Import a sales CSV first."; return; }
		try
		{
			using var client = new HttpClient();
			var request = new Dictionary<string, object?>
			{
				["id"] = Guid.NewGuid().ToString(), ["kind"] = kind, ["runtime"] = "python",
				["requestedAt"] = DateTimeOffset.UtcNow.ToString("O"), ["params"] = new { datasetId = dataset.Id }
			};
			var response = await client.PostAsJsonAsync($"{ApiBaseUrl}/worker/jobs", request);
			if (!response.IsSuccessStatusCode) throw new InvalidOperationException(await response.Content.ReadAsStringAsync());
			ActionMessage = $"{kind} queued for {dataset.Name}. Refresh to follow progress.";
			await LoadDashboardAsync();
		}
		catch (Exception ex) { ActionMessage = $"Job failed: {ex.Message}"; }
	}

	private async void OnRunKpiClicked(object? sender, EventArgs e) => await RunWorkerAsync("sales.kpi");
	private async void OnGenerateHtmlClicked(object? sender, EventArgs e) => await RunWorkerAsync("report.html");

	private async void OnOpenReportClicked(object? sender, EventArgs e)
	{
		var report = currentSnapshot?.RecentReports.FirstOrDefault(item => item.OutputPath.StartsWith(".workspace/reports/"));
		if (report is null) { ActionMessage = "No generated report yet. Run a KPI or HTML job and refresh."; return; }
		await Launcher.Default.OpenAsync(new Uri($"{ApiBaseUrl}/reports/{Uri.EscapeDataString(report.Id)}/content"));
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
