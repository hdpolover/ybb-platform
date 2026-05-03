"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Clock3, Database, Hourglass, Cpu, MemoryStick, Timer } from "lucide-react";
import { PageHeader } from "@/src/admin/page-header";
import { StatCard } from "@/src/admin/stat-card";
import { Badge } from "@/src/ui/badge";
import { Button } from "@/src/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/ui/tabs";
import { getPlatformMetricsSnapshot } from "@/src/shared/api-client";

type ParsedMetric = {
  name: string;
  labels: Record<string, string>;
  value: number;
};

type SlowQueryItem = {
  model: string;
  operation: string;
  value: number;
};

const metricLineRegex = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{([^}]*)\})?\s+([0-9eE+.-]+)$/;

function parsePrometheus(raw: string): ParsedMetric[] {
  const lines = raw.split("\n");
  const result: ParsedMetric[] = [];

  for (const line of lines) {
    const normalized = line.trim();
    if (!normalized || normalized.startsWith("#")) continue;
    const matcher = normalized.match(metricLineRegex);
    if (!matcher) continue;

    const name = matcher[1];
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

    result.push({ name, labels, value });
  }

  return result;
}

function getMetricSeries(metrics: ParsedMetric[], metricName: string): ParsedMetric[] {
  return metrics.filter((metric) => metric.name === metricName);
}

function sumMetric(metrics: ParsedMetric[], metricName: string): number {
  return getMetricSeries(metrics, metricName).reduce((total, item) => total + item.value, 0);
}

function firstMetricValue(metrics: ParsedMetric[], metricName: string): number {
  const first = getMetricSeries(metrics, metricName)[0];
  return first ? first.value : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let normalized = bytes;
  while (normalized >= 1024 && unitIndex < units.length - 1) {
    normalized /= 1024;
    unitIndex += 1;
  }
  return `${formatNumber(normalized)} ${units[unitIndex]}`;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function humanizeMetricLabel(value: string): string {
  if (!value) return "Unknown";
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

function normalizeSlowQueries(metrics: ParsedMetric[]): SlowQueryItem[] {
  return getMetricSeries(metrics, "prisma_slow_query_total")
    .map((item) => ({
      model: humanizeMetricLabel(item.labels.model || "Unknown"),
      operation: humanizeMetricLabel(item.labels.operation || "Unknown"),
      value: item.value,
    }))
    .sort((a, b) => b.value - a.value);
}

function calcRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
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
    const parsed = parsePrometheus(rawMetrics);
    const slowQueries = normalizeSlowQueries(parsed);
    const slowQueryTotal = slowQueries.reduce((total, item) => total + item.value, 0);
    const openConnections = sumMetric(parsed, "prisma_pool_connections_open");
    const idleConnections = sumMetric(parsed, "prisma_pool_connections_idle");
    const waitingConnections = sumMetric(parsed, "prisma_pool_connections_waiting");
    const busyConnections = Math.max(0, openConnections - idleConnections);
    const processCpuTotalSeconds = firstMetricValue(parsed, "process_cpu_seconds_total");
    const processResidentMemoryBytes = firstMetricValue(parsed, "process_resident_memory_bytes");
    const processStartTimeSeconds = firstMetricValue(parsed, "process_start_time_seconds");
    const uptimeSeconds = processStartTimeSeconds > 0 ? Math.max(0, Date.now() / 1000 - processStartTimeSeconds) : 0;
    const metricFamilies = new Set(parsed.map((item) => item.name)).size;
    const slowQueryMax = slowQueries[0]?.value ?? 0;
    const rawPreview = rawMetrics
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .slice(0, 200)
      .join("\n");

    return {
      slowQueryTotal,
      openConnections,
      idleConnections,
      waitingConnections,
      busyConnections,
      processCpuTotalSeconds,
      processResidentMemoryBytes,
      uptimeSeconds,
      metricFamilies,
      slowQueries,
      slowQueryMax,
      rawPreview,
    };
  }, [rawMetrics]);

  const usageRatio = calcRatio(metrics.busyConnections, metrics.openConnections);
  const waitingRatio = calcRatio(metrics.waitingConnections, metrics.openConnections);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Metrics"
        description="Normalized operational telemetry for platform admins"
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
        <StatCard title="Slow Queries (Total)" value={formatNumber(metrics.slowQueryTotal)} icon={Clock3} />
        <StatCard title="DB Connections (Open)" value={formatNumber(metrics.openConnections)} icon={Database} />
        <StatCard title="DB Connections (Busy)" value={formatNumber(metrics.busyConnections)} icon={Activity} />
        <StatCard title="DB Connections (Waiting)" value={formatNumber(metrics.waitingConnections)} icon={Hourglass} />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="queries">Slow Queries</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Runtime Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Uptime</span>
                  <span className="font-semibold text-zinc-900">{formatDuration(metrics.uptimeSeconds)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">CPU time</span>
                  <span className="font-semibold text-zinc-900">{formatDuration(metrics.processCpuTotalSeconds)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Resident memory</span>
                  <span className="font-semibold text-zinc-900">{formatBytes(metrics.processResidentMemoryBytes)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Metric families</span>
                  <span className="font-semibold text-zinc-900">{formatNumber(metrics.metricFamilies)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Database Pool Pressure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Busy connections</span>
                    <span className="font-semibold text-zinc-900">
                      {formatNumber(metrics.busyConnections)} / {formatNumber(metrics.openConnections)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width: `${usageRatio}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Waiting requests</span>
                    <span className="font-semibold text-zinc-900">
                      {formatNumber(metrics.waitingConnections)} / {formatNumber(metrics.openConnections)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100">
                    <div className="h-2 rounded-full bg-amber-500" style={{ width: `${waitingRatio}%` }} />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm">
                    <p className="text-zinc-500">Open</p>
                    <p className="font-semibold text-zinc-900">{formatNumber(metrics.openConnections)}</p>
                  </div>
                  <div className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm">
                    <p className="text-zinc-500">Idle</p>
                    <p className="font-semibold text-zinc-900">{formatNumber(metrics.idleConnections)}</p>
                  </div>
                  <div className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm">
                    <p className="text-zinc-500">Waiting</p>
                    <p className="font-semibold text-zinc-900">{formatNumber(metrics.waitingConnections)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-5">
                <Clock3 className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Slow query events</p>
                  <p className="text-xl font-semibold text-zinc-900">{formatNumber(metrics.slowQueryTotal)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-5">
                <Cpu className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">CPU consumed</p>
                  <p className="text-xl font-semibold text-zinc-900">{formatDuration(metrics.processCpuTotalSeconds)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-5">
                <MemoryStick className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Memory footprint</p>
                  <p className="text-xl font-semibold text-zinc-900">{formatBytes(metrics.processResidentMemoryBytes)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="queries">
          <Card>
            <CardHeader>
              <CardTitle>Slow Query Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.slowQueries.length === 0 ? (
                <p className="text-sm text-zinc-500">No slow query samples found in current metrics scrape.</p>
              ) : (
                <div className="space-y-2">
                  {metrics.slowQueries.map((item, index) => {
                    const ratio = metrics.slowQueryMax > 0 ? (item.value / metrics.slowQueryMax) * 100 : 0;
                    return (
                      <div key={`${item.model}-${item.operation}-${index}`} className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-900">{item.model}</p>
                            <p className="text-xs text-zinc-500">{item.operation}</p>
                          </div>
                          <Badge variant={item.value > 0 ? "warning" : "secondary"}>{formatNumber(item.value)}</Badge>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-200">
                          <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${ratio}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnostics">
          <Card>
            <CardHeader>
              <CardTitle>Prometheus Raw (sanitized preview)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Timer className="h-4 w-4" />
                <span>Raw output is trimmed to metric lines only and capped for readability.</span>
              </div>
              <pre className="max-h-[420px] overflow-auto rounded-md border border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-800">
                {metrics.rawPreview || (loading ? "Loading metrics..." : "No metrics available.")}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
