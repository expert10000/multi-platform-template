using System.Text.Json;
using EnterpriseAnalytics.Maui.Contracts;

namespace EnterpriseAnalytics.Maui.Services;

public sealed class DashboardSnapshotProvider
{
	private static readonly JsonSerializerOptions JsonOptions = new()
	{
		PropertyNameCaseInsensitive = true
	};

	public async Task<DashboardSnapshot> GetDashboardSnapshotAsync(CancellationToken cancellationToken = default)
	{
		await using var stream = await FileSystem.OpenAppPackageFileAsync("dashboard-snapshot.json");
		var snapshot = await JsonSerializer.DeserializeAsync<DashboardSnapshot>(stream, JsonOptions, cancellationToken);

		return snapshot ?? throw new InvalidOperationException("Dashboard snapshot asset could not be loaded.");
	}
}
