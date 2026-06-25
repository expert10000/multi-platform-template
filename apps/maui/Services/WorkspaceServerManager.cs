using System.Diagnostics;

namespace EnterpriseAnalytics.Maui.Services;

public sealed class WorkspaceServerManager
{
	private static readonly Uri HealthEndpoint = new("http://127.0.0.1:8787/health");
	private Process? serverProcess;

	public async Task<bool> EnsureStartedAsync(CancellationToken cancellationToken = default)
	{
		if (await IsServerAvailableAsync(cancellationToken))
		{
			return true;
		}

		var serverEntry = FindWorkspaceServerEntry();
		if (serverEntry is null)
		{
			return false;
		}

		var repoRoot = Directory.GetParent(Path.GetDirectoryName(serverEntry)!)?.Parent?.Parent?.FullName;
		var databasePath = repoRoot is null
			? null
			: Path.Combine(repoRoot, ".workspace", "workspace.sqlite3");

		var startInfo = new ProcessStartInfo
		{
			FileName = "node",
			Arguments = $"\"{serverEntry}\"",
			UseShellExecute = false,
			CreateNoWindow = true
		};
		startInfo.Environment["HOST"] = "127.0.0.1";
		startInfo.Environment["PORT"] = "8787";
		if (databasePath is not null)
		{
			startInfo.Environment["WORKSPACE_DB_PATH"] = databasePath;
		}

		try
		{
			serverProcess = Process.Start(startInfo);
		}
		catch
		{
			return false;
		}

		for (var attempt = 0; attempt < 30; attempt += 1)
		{
			if (await IsServerAvailableAsync(cancellationToken))
			{
				return true;
			}

			await Task.Delay(100, cancellationToken);
		}

		return false;
	}

	private static async Task<bool> IsServerAvailableAsync(CancellationToken cancellationToken)
	{
		try
		{
			using var httpClient = new HttpClient
			{
				Timeout = TimeSpan.FromMilliseconds(750)
			};
			using var response = await httpClient.GetAsync(HealthEndpoint, cancellationToken);
			return response.IsSuccessStatusCode;
		}
		catch
		{
			return false;
		}
	}

	private static string? FindWorkspaceServerEntry()
	{
		foreach (var startPath in new[] { Environment.CurrentDirectory, AppContext.BaseDirectory })
		{
			var directory = new DirectoryInfo(startPath);
			while (directory is not null)
			{
				var candidate = Path.Combine(directory.FullName, "services", "workspace-server", "dist", "server.js");
				if (File.Exists(candidate))
				{
					return candidate;
				}

				directory = directory.Parent;
			}
		}

		return null;
	}
}
