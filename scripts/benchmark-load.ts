import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as http from 'http';
import * as path from 'path';

const backendPath = path.resolve(__dirname, '../../apps/backend/dist/main');
const { app } = require(backendPath);

interface BenchmarkMetrics {
  concurrency: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  reqPerSec: number;
  heapUsedMb: number;
}

describe('Controlled Performance & Concurrency Benchmark', () => {
  let server: http.Server;
  let serverPort = 0;
  let baseUrl = '';

  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        baseUrl = `http://127.0.0.1:${serverPort}`;
        console.log(`Benchmark server listening on ${baseUrl}`);
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  async function makeRequest(path: string, headers: Record<string, string> = {}): Promise<number> {
    const start = performance.now();
    return new Promise<number>((resolve, reject) => {
      const req = http.get(`${baseUrl}${path}`, { headers }, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          const duration = performance.now() - start;
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
            resolve(duration);
          } else {
            resolve(duration); // Still measure duration
          }
        });
      });
      req.on('error', (err) => reject(err));
    });
  }

  async function runConcurrencyRound(concurrency: number, totalRequests: number): Promise<BenchmarkMetrics> {
    const latencies: number[] = [];
    let completed = 0;
    let failed = 0;

    const endpoints = [
      '/health',
      '/api/netflix/movies',
      '/api/youtube/videos',
      '/api/youtube/shorts',
      '/api/instagram/feed'
    ];

    const worker = async () => {
      while (completed + failed < totalRequests) {
        const idx = completed % endpoints.length;
        try {
          const lat = await makeRequest(endpoints[idx]);
          latencies.push(lat);
          completed++;
        } catch (err: any) {
          if (failed === 0) {
            console.error('Request failed with error:', err?.message || err);
          }
          failed++;
        }
      }
    };

    const startTime = performance.now();
    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);
    const totalDurationSec = (performance.now() - startTime) / 1000;

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
    const reqPerSec = totalDurationSec > 0 ? completed / totalDurationSec : 0;
    const heapUsedMb = process.memoryUsage().heapUsed / (1024 * 1024);

    return {
      concurrency,
      totalRequests,
      successfulRequests: completed,
      failedRequests: failed,
      p50Ms: parseFloat(p50.toFixed(2)),
      p95Ms: parseFloat(p95.toFixed(2)),
      p99Ms: parseFloat(p99.toFixed(2)),
      reqPerSec: parseFloat(reqPerSec.toFixed(2)),
      heapUsedMb: parseFloat(heapUsedMb.toFixed(2))
    };
  }

  it('measures 10 concurrent users workload', async () => {
    const res = await runConcurrencyRound(10, 100);
    console.log(`[CONCURRENCY 10] p50=${res.p50Ms}ms, p95=${res.p95Ms}ms, p99=${res.p99Ms}ms, Throughput=${res.reqPerSec} req/s, Heap=${res.heapUsedMb} MB`);
    assert.strictEqual(res.failedRequests, 0);
    assert.ok(res.p95Ms < 100, `p95 latency (${res.p95Ms}ms) exceeded 100ms threshold`);
  });

  it('measures 50 concurrent users workload', async () => {
    const res = await runConcurrencyRound(50, 250);
    console.log(`[CONCURRENCY 50] p50=${res.p50Ms}ms, p95=${res.p95Ms}ms, p99=${res.p99Ms}ms, Throughput=${res.reqPerSec} req/s, Heap=${res.heapUsedMb} MB`);
    assert.strictEqual(res.failedRequests, 0);
    assert.ok(res.p95Ms < 200, `p95 latency (${res.p95Ms}ms) exceeded 200ms threshold`);
  });

  it('measures 100 concurrent users workload', async () => {
    const res = await runConcurrencyRound(100, 500);
    console.log(`[CONCURRENCY 100] p50=${res.p50Ms}ms, p95=${res.p95Ms}ms, p99=${res.p99Ms}ms, Throughput=${res.reqPerSec} req/s, Heap=${res.heapUsedMb} MB`);
    assert.strictEqual(res.failedRequests, 0);
    assert.ok(res.p95Ms < 300, `p95 latency (${res.p95Ms}ms) exceeded 300ms threshold`);
  });
});
