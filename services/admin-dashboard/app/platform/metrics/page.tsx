"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Clock3, Database, Hourglass } from "lucide-react";
import { PageHeader } from "@/src/admin/page-header";
import { StatCard } from "@/src/admin/stat-card";
import { Button } from "@/src/ui/button";
import { getPlatformMetricsSnapshot } from "@/src/shared/api-client";

type MetricSeries = {
  labels: Record<string, string>;
  value: number;
};

function parseMetricSeries(raw: string, metricName: string): MetricSeries[] {
  const lines = raw.split("\n");
  const result: MetricSeries[] = [];

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    if (!line.startsWith(metricName)) continue;

    const matcher = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{([^}]*)\})?\s+([0-9eE+.-]+)$/);
    if (!matcher) continue;

    const labelsRaw = matcher[3] ?? "";
    const value = Number(matcher[4]);
    if (!Number.isFinite(value)) continue;

    const labels: Record<string, string> = {};
    if (labelsRaw) {
      for (const part of labelsRaw.split(",")) {
        const [key, rawValue] = part.split("=");
        if (!key || !rawValue) continue;
        labels[key.trim()] = rawValue.trim().replace(/^"|"$/g, "");
      }
    }

    result.push({ labels, value });
  }

  return result;
}

function sumMetric(raw: string, metricName: string): number {
  return parseMetricSeries(raw, metricName).reduce((total, item) => total + item.value, 0);
}

export default function PlatformMetricsPage() {
  const [rawMetrics, setRawMetrics] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPlatformMetricsSnapshot();
      setRawMetrics(data.raw);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load platform metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  const metrics = useMemo(() => {
    const slowQueryTotal = sumMetric(rawMetrics, "prisma_slow_query_total");
    const openConnections = sumMetric(rawMetrics, "prisma_pool_connections_open");
    const idleConnections = sumMetric(rawMetrics, "prisma_pool_connections_idle");
    const waitingConnections = sumMetric(rawMetrics, "prisma_pool_connections_waiting");
    const slowQuerySeries = parseMetricSeries(rawMetrics, "prisma_slow_query_total");

    return {
      slowQueryTotal,
      openConnections,
      idleConnections,
      waitingConnections,
      slowQuerySeries,
    };
  }, [rawMetrics]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Metrics"
        description="Live Prometheus metrics from the API service"
        actions={
          <Button variant="outline" size="sm" onClick={() => void fetchMetrics()} loading={loading}>
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Slow Queries (Total)" value={metrics.slowQueryTotal} icon={Clock3} />
        <StatCard title="DB Connections (Open)" value={metrics.openConnections} icon={Database} />
        <StatCard title="DB Connections (Idle)" value={metrics.idleConnections} icon={Activity} />
        <StatCard title="DB Connections (Waiting)" value={metrics.waitingConnections} icon={Hourglass} />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Slow Query Breakdown</h2>
        {metrics.slowQuerySeries.length === 0 ? (
          <p className="text-sm text-zinc-500">No slow query samples found in current metrics scrape.</p>
        ) : (
          <div className="space-y-2">
            {metrics.slowQuerySeries.map((series, index) => {
              const model = series.labels.model || "unknown";
              const operation = series.labels.operation || "unknown";
              return (
                <div
                  key={`${model}-${operation}-${index}`}
                  className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-zinc-900">{model}</span>
                  <span className="text-zinc-500"> / {operation}</span>
                  <span className="float-right font-semibold text-zinc-900">{series.value}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Raw Metrics</h2>
        <pre className="max-h-[480px] overflow-auto rounded-md border border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-800">
          {rawMetrics || (loading ? "Loading metrics..." : "No metrics available.")}
        </pre>
      </div>
    </div>
  );
}
