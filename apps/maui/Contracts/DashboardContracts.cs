namespace EnterpriseAnalytics.Maui.Contracts;

public sealed record DashboardSnapshot(
	DashboardCounts Counts,
	KpiSummary Kpis,
	IReadOnlyList<ProjectDto> RecentProjects,
	IReadOnlyList<DatasetDto> RecentDatasets,
	IReadOnlyList<JobDto> RecentJobs,
	IReadOnlyList<ReportDto> RecentReports);

public sealed record DashboardCounts(
	int Projects,
	int Datasets,
	int Jobs,
	int Reports);

public sealed record KpiSummary(
	decimal Revenue,
	decimal Cost,
	decimal Profit,
	decimal Margin,
	decimal Growth);

public sealed record ProjectDto(
	string Id,
	string Name,
	string Description,
	string OwnerId,
	DateTimeOffset CreatedAt,
	DateTimeOffset UpdatedAt);

public sealed record DatasetDto(
	string Id,
	string ProjectId,
	string Name,
	string Kind,
	string SourcePath,
	int RowCount,
	DateTimeOffset ImportedAt);

public sealed record JobDto(
	string Id,
	string ProjectId,
	string DatasetId,
	string Kind,
	string Status,
	string RequestedBy,
	DateTimeOffset CreatedAt,
	DateTimeOffset? CompletedAt);

public sealed record ReportDto(
	string Id,
	string ProjectId,
	string JobId,
	string Title,
	string Format,
	string OutputPath,
	DateTimeOffset CreatedAt);
