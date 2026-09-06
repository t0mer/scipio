import client from 'prom-client';

/**
 * Prometheus metrics for one app instance. A fresh {@link client.Registry} per
 * instance keeps the app factory re-instantiable (tests build many apps) without
 * the global-registry double-registration errors the default registry causes.
 *
 * Metric labels never include account numbers or credentials — only companyId
 * and status — so `/metrics` cannot leak sensitive data.
 */
export interface Metrics {
  readonly registry: client.Registry;
  readonly contentType: string;
  /** Records a completed scrape's outcome and duration. */
  observeScrape(company: string, status: string, durationSeconds: number): void;
  /** Sets the current number of pending (queued) jobs. */
  setQueueDepth(n: number): void;
  /** Counts an HTTP request by method, route template, and status code. */
  observeHttp(method: string, route: string, status: number): void;
  render(): Promise<string>;
}

export function createMetrics(): Metrics {
  const registry = new client.Registry();
  client.collectDefaultMetrics({ register: registry, prefix: 'scipio_' });

  const scrapes = new client.Counter({
    name: 'scipio_scrapes_total',
    help: 'Total scrapes by company and outcome status.',
    labelNames: ['company', 'status'],
    registers: [registry],
  });
  const duration = new client.Histogram({
    name: 'scipio_scrape_duration_seconds',
    help: 'Scrape duration in seconds by company and status.',
    labelNames: ['company', 'status'],
    buckets: [1, 5, 10, 30, 60, 120, 180, 240, 300],
    registers: [registry],
  });
  const queueDepth = new client.Gauge({
    name: 'scipio_queue_depth',
    help: 'Number of jobs currently queued (pending).',
    registers: [registry],
  });
  const http = new client.Counter({
    name: 'scipio_http_requests_total',
    help: 'HTTP requests by method, route, and status code.',
    labelNames: ['method', 'route', 'status'],
    registers: [registry],
  });

  return {
    registry,
    contentType: registry.contentType,
    observeScrape: (company, status, durationSeconds) => {
      scrapes.inc({ company, status });
      duration.observe({ company, status }, durationSeconds);
    },
    setQueueDepth: (n) => queueDepth.set(n),
    observeHttp: (method, route, status) => http.inc({ method, route, status: String(status) }),
    render: () => registry.metrics(),
  };
}
