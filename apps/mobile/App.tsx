import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BarChart3, Database, FileText, Play, Settings } from "lucide-react-native";
import { demoDashboardSnapshot, formatCurrency, formatPercent, type DashboardSnapshot } from "@enterprise-analytics/core";

type MobileView = "dashboard" | "datasets" | "jobs" | "reports";

const viewTitles: Record<MobileView, string> = {
  dashboard: "Enterprise Platform",
  datasets: "Datasets",
  jobs: "Python Worker",
  reports: "Reports"
};

const navItems: Array<{ id: MobileView; label: string; Icon: typeof BarChart3 }> = [
  { id: "dashboard", label: "Dashboard", Icon: BarChart3 },
  { id: "datasets", label: "Datasets", Icon: Database },
  { id: "jobs", label: "Jobs", Icon: Play },
  { id: "reports", label: "Reports", Icon: FileText }
];

export default function App() {
  const [activeView, setActiveView] = useState<MobileView>("dashboard");
  const dashboard = useMemo<DashboardSnapshot>(() => demoDashboardSnapshot, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.shell}>
        <View style={styles.topbar}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>EP</Text>
            </View>
            <View>
              <Text style={styles.title}>{viewTitles[activeView]}</Text>
            </View>
          </View>
          <TouchableOpacity accessibilityLabel="Workspace settings" style={styles.iconButton}>
            <Settings size={19} color="#f8faf8" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {activeView === "dashboard" ? <DashboardView dashboard={dashboard} /> : null}
          {activeView === "datasets" ? <DatasetsView dashboard={dashboard} /> : null}
          {activeView === "jobs" ? <JobsView dashboard={dashboard} /> : null}
          {activeView === "reports" ? <ReportsView dashboard={dashboard} /> : null}
        </ScrollView>

        <View style={styles.bottomNav}>
          {navItems.map(({ id, label, Icon }) => {
            const active = activeView === id;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={id}
                onPress={() => setActiveView(id)}
                style={[styles.navItem, active ? styles.navItemActive : null]}
              >
                <Icon size={18} color={active ? "#17202a" : "#e7ece8"} />
                <Text style={[styles.navText, active ? styles.navTextActive : null]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function DashboardView({ dashboard }: { dashboard: DashboardSnapshot }) {
  return (
    <>
      <View style={styles.metricGrid}>
        <MetricCard label="Projects" value={String(dashboard.counts.projects)} detail="active workspaces" />
        <MetricCard label="Datasets" value={String(dashboard.counts.datasets)} detail="CSV and Excel assets" />
        <MetricCard label="Jobs" value={String(dashboard.counts.jobs)} detail="analysis runs" />
        <MetricCard label="Reports" value={String(dashboard.counts.reports)} detail="published outputs" />
      </View>

      <View style={styles.kpiStack}>
        <MetricCard label="Revenue" value={formatCurrency(dashboard.kpis.revenue)} detail="sample Q1" />
        <MetricCard label="Profit" value={formatCurrency(dashboard.kpis.profit)} detail={`${formatPercent(dashboard.kpis.margin)} margin`} />
        <MetricCard label="Growth" value={formatPercent(dashboard.kpis.growth)} detail="period over period" />
      </View>

      <DatasetsView dashboard={dashboard} compact />
      <JobsView dashboard={dashboard} compact />
    </>
  );
}

function DatasetsView({ dashboard, compact = false }: { dashboard: DashboardSnapshot; compact?: boolean }) {
  const rows = compact ? dashboard.recentDatasets.slice(0, 3) : dashboard.recentDatasets;
  return (
    <Panel title="Asset Browser" detail="Business files registered in SQLite metadata">
      {rows.map((dataset) => (
        <ListRow
          key={dataset.id}
          title={dataset.name}
          meta={`${dataset.kind} • ${dataset.rowCount.toLocaleString()} rows`}
          detail={dataset.sourcePath}
        />
      ))}
    </Panel>
  );
}

function JobsView({ dashboard, compact = false }: { dashboard: DashboardSnapshot; compact?: boolean }) {
  return (
    <Panel title="Python Worker" detail="Background processing for analytics jobs">
      {dashboard.recentJobs.map((job) => (
        <ListRow key={job.id} title={job.kind} meta={job.status} detail={job.datasetId.replace("dataset-", "")} />
      ))}
      {!compact ? (
        <>
          <ListRow title="Python" meta="Sales KPI, forecasting, reports" detail="Pandas, NumPy, SciPy, Matplotlib" />
          <ListRow title="Node" meta="CSV import, validation, email" detail="JavaScript-native workflow automation" />
        </>
      ) : null}
    </Panel>
  );
}

function ReportsView({ dashboard }: { dashboard: DashboardSnapshot }) {
  return (
    <Panel title="Reports" detail="Executive summaries and published outputs">
      {dashboard.recentReports.map((report) => (
        <ListRow key={report.id} title={report.title} meta={report.format.toUpperCase()} detail={report.outputPath} />
      ))}
      <ListRow title="Report Pipeline" meta="Analysis -> Summary -> Publish" detail="Worker results become HTML or PDF-ready artifacts" />
    </Panel>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

function Panel({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.panelDetail}>{detail}</Text>
      <View style={styles.panelBody}>{children}</View>
    </View>
  );
}

function ListRow({ title, meta, detail }: { title: string; meta: string; detail: string }) {
  return (
    <View style={styles.listRow}>
      <View style={styles.listRowHeader}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.listMeta}>{meta}</Text>
      </View>
      <Text style={styles.listDetail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4f6f3"
  },
  shell: {
    flex: 1,
    backgroundColor: "#f4f6f3"
  },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 14,
    paddingTop: 12
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  brandMark: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#9bd3ae"
  },
  brandMarkText: {
    color: "#17202a",
    fontWeight: "800"
  },
  eyebrow: {
    color: "#65736b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: {
    color: "#17202a",
    fontSize: 25,
    fontWeight: "800"
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#17202a"
  },
  content: {
    gap: 14,
    padding: 18,
    paddingBottom: 104
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  kpiStack: {
    gap: 12
  },
  metricCard: {
    minWidth: "47%",
    flexGrow: 1,
    gap: 5,
    padding: 16,
    borderWidth: 1,
    borderColor: "#dfe5df",
    borderRadius: 8,
    backgroundColor: "#ffffff"
  },
  metricLabel: {
    color: "#5e6a63",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  metricValue: {
    color: "#17202a",
    fontSize: 23,
    fontWeight: "800"
  },
  metricDetail: {
    color: "#65736b",
    fontSize: 13
  },
  panel: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#dfe5df",
    borderRadius: 8,
    backgroundColor: "#ffffff"
  },
  panelTitle: {
    color: "#17202a",
    fontSize: 17,
    fontWeight: "800"
  },
  panelDetail: {
    marginTop: 2,
    color: "#66736b",
    fontSize: 13
  },
  panelBody: {
    marginTop: 12,
    gap: 10
  },
  listRow: {
    gap: 5,
    padding: 12,
    borderWidth: 1,
    borderColor: "#edf0ed",
    borderRadius: 8,
    backgroundColor: "#f8faf8"
  },
  listRowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  listTitle: {
    flex: 1,
    color: "#17202a",
    fontSize: 14,
    fontWeight: "800"
  },
  listMeta: {
    color: "#21724b",
    fontSize: 12,
    fontWeight: "800"
  },
  listDetail: {
    color: "#66736b",
    fontSize: 12
  },
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 6,
    padding: 12,
    paddingBottom: 18,
    backgroundColor: "#17202a"
  },
  navItem: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: 8
  },
  navItemActive: {
    backgroundColor: "#f0c36a"
  },
  navText: {
    color: "#e7ece8",
    fontSize: 11,
    fontWeight: "800"
  },
  navTextActive: {
    color: "#17202a"
  }
});
