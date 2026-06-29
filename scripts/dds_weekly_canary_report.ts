import { getAdminDb, getFirebaseAdminApp } from '../src/lib/firebase/admin';

type TelemetryDoc = {
  event: 'success' | 'error';
  flow: 'single' | 'monthly' | 'weekly';
  engineMode: 'current' | 'baseline';
  status: number;
  latencyMs: number;
  templateId?: string;
  categoryName?: string;
  errorCode?: string;
  errorMessage?: string;
  strategy?: string;
  recentWorkoutsAnalyzed?: number;
  createdAt?: { toDate?: () => Date };
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] || 0;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function main() {
  const accountId = process.env.DDS_CANARY_ACCOUNT_ID || process.env.DDS_AB_ACCOUNT_ID || 'master';
  const lookbackHours = Math.max(1, Number.parseInt(process.env.DDS_CANARY_LOOKBACK_HOURS || '24', 10) || 24);
  const minRequests = Math.max(1, Number.parseInt(process.env.DDS_CANARY_MIN_REQUESTS || '8', 10) || 8);

  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  const db = getAdminDb();
  const projectId = getFirebaseAdminApp().options.projectId || 'unknown';

  const snapshot = await db
    .collection('ddsFillTelemetry')
    .where('createdAt', '>=', since)
    .orderBy('createdAt', 'desc')
    .limit(2000)
    .get();

  const docs = snapshot.docs
    .map((doc) => doc.data() as TelemetryDoc)
    .filter((item) => item && item.flow === 'weekly');

  const total = docs.length;
  const success = docs.filter((item) => item.event === 'success' && item.status < 400).length;
  const errors = docs.filter((item) => item.event === 'error' || item.status >= 400);
  const latencies = docs.map((item) => item.latencyMs).filter((ms) => Number.isFinite(ms) && ms >= 0);

  const successRate = total > 0 ? success / total : 0;
  const errorRate = total > 0 ? errors.length / total : 0;
  const p95Latency = percentile(latencies, 95);
  const avgLatency = average(latencies);

  const errorsByCode = new Map<string, number>();
  for (const item of errors) {
    const key = item.errorCode || `status_${item.status}`;
    errorsByCode.set(key, (errorsByCode.get(key) || 0) + 1);
  }

  const byEngine = {
    current: docs.filter((item) => item.engineMode === 'current').length,
    baseline: docs.filter((item) => item.engineMode === 'baseline').length,
  };

  const checks = {
    hasSample: total >= minRequests,
    successRate: successRate >= 0.95,
    p95Latency: p95Latency <= 2000,
    noFlowDisabled: (errorsByCode.get('dds_flow_disabled') || 0) === 0,
  };

  const passCount = Object.values(checks).filter(Boolean).length;
  const verdict = passCount >= 3 ? 'pass' : 'fail';

  console.log(JSON.stringify({
    accountId,
    projectId,
    lookbackHours,
    summary: {
      total,
      success,
      errors: errors.length,
      successRate,
      errorRate,
      avgLatency,
      p95Latency,
      byEngine,
      errorsByCode: Object.fromEntries(errorsByCode.entries()),
    },
    checks,
    verdict,
    rule: 'pass when at least 3/4 checks are true',
    generatedAt: new Date().toISOString(),
  }, null, 2));
}

main().catch((error) => {
  console.error('DDS weekly canary report failed:', error);
  process.exitCode = 1;
});
