using System.Text.Json;
using System.Net.Http.Json;
using EnterpriseAnalytics.Maui.Contracts;

namespace EnterpriseAnalytics.Maui.Services;

public sealed class DashboardSnapshotProvider
{
	private static readonly Uri DashboardEndpoint = new("http://127.0.0.1:8787/api/dashboard/snapshot");
	private readonly WorkspaceServerManager workspaceServerManager = new();
	private static readonly JsonSerializerOptions JsonOptions = new()
	{
		PropertyNameCaseInsensitive = true
	};

	public async Task<DashboardSnapshotLoadResult> GetDashboardSnapshotAsync(CancellationToken cancellationToken = default)
	{
		await workspaceServerManager.EnsureStartedAsync(cancellationToken);

		try
		{
			using var httpClient = new HttpClient
			{
				Timeout = TimeSpan.FromSeconds(2)
			};
			var remoteSnapshot = await httpClient.GetFromJsonAsync<DashboardSnapshot>(DashboardEndpoint, JsonOptions, cancellationToken);
			if (remoteSnapshot is not null)
			{
				return new(remoteSnapshot, DashboardDataSource.Sqlite, "SQLite API started", Color.FromArgb("#C9F0D8"), Color.FromArgb("#0F3F2C"));
			}
		}
		catch
		{
			// The native shell can still run from bundled contract data when the local server is offline.
		}

		await using var stream = await FileSystem.OpenAppPackageFileAsync("dashboard-snapshot.json");
		var snapshot = await JsonSerializer.DeserializeAsync<DashboardSnapshot>(stream, JsonOptions, cancellationToken);

		return new(
			snapshot ?? throw new InvalidOperationException("Dashboard snapshot asset could not be loaded."),
			DashboardDataSource.Local,
			"Local fallback",
			Color.FromArgb("#FFE2A8"),
			Color.FromArgb("#5C3A00"));
	}
}

public enum DashboardDataSource
{
	Sqlite,
	Local
}

public sealed record DashboardSnapshotLoadResult(
	DashboardSnapshot Snapshot,
	DashboardDataSource Source,
	string StatusText,
	Color StatusBackgroundColor,
	Color StatusTextColor);
