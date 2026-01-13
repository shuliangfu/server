/**
 * Metrics/Monitoring 中间件
 *
 * 收集请求统计信息，提供 Prometheus 格式的指标
 */

import type { Middleware } from "@dreamer/middleware";
import type { HttpContext } from "../context.ts";

/**
 * 请求统计信息
 */
interface RequestStats {
  /** 请求总数 */
  total: number;
  /** 成功请求数（2xx） */
  success: number;
  /** 客户端错误数（4xx） */
  clientError: number;
  /** 服务器错误数（5xx） */
  serverError: number;
  /** 其他状态码数 */
  other: number;
  /** 响应时间统计（毫秒） */
  responseTime: {
    /** 总响应时间 */
    total: number;
    /** 最小响应时间 */
    min: number;
    /** 最大响应时间 */
    max: number;
    /** 响应时间列表（用于计算分位数） */
    times: number[];
  };
  /** 按路径统计 */
  byPath: Map<string, {
    count: number;
    totalTime: number;
    errors: number;
  }>;
  /** 按方法统计 */
  byMethod: Map<string, number>;
  /** 按状态码统计 */
  byStatus: Map<number, number>;
}

/**
 * Metrics 配置选项
 */
export interface MetricsOptions {
  /** 是否启用指标收集（默认：true） */
  enabled?: boolean;
  /** 指标端点路径（默认：/metrics） */
  endpoint?: string;
  /** 是否包含响应时间分位数（P50、P95、P99）（默认：true） */
  includePercentiles?: boolean;
  /** 最大保留的响应时间样本数（默认：1000） */
  maxSamples?: number;
  /** 自定义标签提取函数 */
  extractLabels?: (ctx: HttpContext) => Record<string, string>;
}

/**
 * 全局指标存储
 */
let globalStats: RequestStats = {
  total: 0,
  success: 0,
  clientError: 0,
  serverError: 0,
  other: 0,
  responseTime: {
    total: 0,
    min: Infinity,
    max: 0,
    times: [],
  },
  byPath: new Map(),
  byMethod: new Map(),
  byStatus: new Map(),
};

/**
 * 创建 Metrics 中间件
 *
 * @param options 配置选项
 * @returns Metrics 中间件函数
 *
 * @example
 * ```typescript
 * app.use(metrics());
 *
 * // 自定义配置
 * app.use(metrics({
 *   endpoint: "/prometheus",
 *   includePercentiles: true,
 * }));
 * ```
 */
export function metrics(
  options: MetricsOptions = {},
): Middleware<HttpContext> {
  const {
    enabled = true,
    endpoint = "/metrics",
    includePercentiles = true,
    maxSamples = 1000,
    extractLabels = () => ({}),
  } = options;

  return async (ctx: HttpContext, next: () => Promise<void>): Promise<void> => {
    // 处理指标端点请求
    if (ctx.path === endpoint && ctx.method === "GET") {
      ctx.response = new Response(
        generatePrometheusMetrics(includePercentiles),
        {
          status: 200,
          headers: {
            "Content-Type": "text/plain; version=0.0.4",
          },
        },
      );
      return;
    }

    if (!enabled) {
      await next();
      return;
    }

    // 记录开始时间
    const startTime = Date.now();

    // 提取标签（预留功能，用于将来支持带标签的指标）
    const _labels = extractLabels(ctx);

    // 处理请求
    await next();

    // 计算响应时间
    const responseTime = Date.now() - startTime;

    // 更新统计信息
    updateStats(ctx, responseTime, maxSamples);
  };
}

/**
 * 更新统计信息
 */
function updateStats(
  ctx: HttpContext,
  responseTime: number,
  maxSamples: number,
): void {
  const status = ctx.response?.status || 0;
  const path = ctx.path;
  const method = ctx.method;

  // 更新总数
  globalStats.total++;

  // 更新状态码统计
  if (status >= 200 && status < 300) {
    globalStats.success++;
  } else if (status >= 400 && status < 500) {
    globalStats.clientError++;
  } else if (status >= 500) {
    globalStats.serverError++;
  } else {
    globalStats.other++;
  }

  // 更新状态码计数
  const statusCount = globalStats.byStatus.get(status) || 0;
  globalStats.byStatus.set(status, statusCount + 1);

  // 更新方法统计
  const methodCount = globalStats.byMethod.get(method) || 0;
  globalStats.byMethod.set(method, methodCount + 1);

  // 更新路径统计
  const pathStats = globalStats.byPath.get(path) || {
    count: 0,
    totalTime: 0,
    errors: 0,
  };
  pathStats.count++;
  pathStats.totalTime += responseTime;
  if (status >= 400) {
    pathStats.errors++;
  }
  globalStats.byPath.set(path, pathStats);

  // 更新响应时间统计
  globalStats.responseTime.total += responseTime;
  globalStats.responseTime.min = Math.min(
    globalStats.responseTime.min,
    responseTime,
  );
  globalStats.responseTime.max = Math.max(
    globalStats.responseTime.max,
    responseTime,
  );

  // 保留响应时间样本（限制数量）
  globalStats.responseTime.times.push(responseTime);
  if (globalStats.responseTime.times.length > maxSamples) {
    globalStats.responseTime.times.shift();
  }
}

/**
 * 生成 Prometheus 格式的指标
 *
 * @param includePercentiles 是否包含分位数（P50、P95、P99）
 */
function generatePrometheusMetrics(includePercentiles: boolean): string {
  const lines: string[] = [];

  // HTTP 请求总数
  lines.push(`# HELP http_requests_total Total number of HTTP requests`);
  lines.push(`# TYPE http_requests_total counter`);
  lines.push(`http_requests_total ${globalStats.total}`);

  // HTTP 请求成功数
  lines.push(
    `# HELP http_requests_success Total number of successful HTTP requests (2xx)`,
  );
  lines.push(`# TYPE http_requests_success counter`);
  lines.push(`http_requests_success ${globalStats.success}`);

  // HTTP 请求错误数
  lines.push(
    `# HELP http_requests_client_error Total number of client errors (4xx)`,
  );
  lines.push(`# TYPE http_requests_client_error counter`);
  lines.push(`http_requests_client_error ${globalStats.clientError}`);

  lines.push(
    `# HELP http_requests_server_error Total number of server errors (5xx)`,
  );
  lines.push(`# TYPE http_requests_server_error counter`);
  lines.push(`http_requests_server_error ${globalStats.serverError}`);

  // HTTP 响应时间
  const avgTime = globalStats.total > 0
    ? globalStats.responseTime.total / globalStats.total
    : 0;
  lines.push(
    `# HELP http_request_duration_seconds HTTP request duration in seconds`,
  );
  lines.push(`# TYPE http_request_duration_seconds summary`);
  lines.push(
    `http_request_duration_seconds_sum ${
      (globalStats.responseTime.total / 1000).toFixed(3)
    }`,
  );
  lines.push(
    `http_request_duration_seconds_count ${globalStats.total}`,
  );
  // 如果启用分位数，计算并输出分位数
  if (includePercentiles && globalStats.responseTime.times.length > 0) {
    const sorted = [...globalStats.responseTime.times].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    lines.push(
      `http_request_duration_seconds{quantile="0.5"} ${
        (p50 / 1000).toFixed(3)
      }`,
    );
    lines.push(
      `http_request_duration_seconds{quantile="0.95"} ${
        (p95 / 1000).toFixed(3)
      }`,
    );
    lines.push(
      `http_request_duration_seconds{quantile="0.99"} ${
        (p99 / 1000).toFixed(3)
      }`,
    );
  } else {
    // 如果不启用分位数，只输出平均值
    lines.push(
      `http_request_duration_seconds{quantile="0.5"} ${
        (avgTime / 1000).toFixed(3)
      }`,
    );
  }

  // 按方法统计
  for (const [method, count] of globalStats.byMethod.entries()) {
    lines.push(
      `# HELP http_requests_by_method Total number of HTTP requests by method`,
    );
    lines.push(`# TYPE http_requests_by_method counter`);
    lines.push(`http_requests_by_method{method="${method}"} ${count}`);
  }

  // 按状态码统计
  for (const [status, count] of globalStats.byStatus.entries()) {
    lines.push(
      `# HELP http_requests_by_status Total number of HTTP requests by status code`,
    );
    lines.push(`# TYPE http_requests_by_status counter`);
    lines.push(`http_requests_by_status{status="${status}"} ${count}`);
  }

  return lines.join("\n") + "\n";
}

/**
 * 获取当前统计信息（用于调试）
 */
export function getMetricsStats(): RequestStats {
  return { ...globalStats };
}

/**
 * 重置统计信息
 */
export function resetMetrics(): void {
  globalStats = {
    total: 0,
    success: 0,
    clientError: 0,
    serverError: 0,
    other: 0,
    responseTime: {
      total: 0,
      min: Infinity,
      max: 0,
      times: [],
    },
    byPath: new Map(),
    byMethod: new Map(),
    byStatus: new Map(),
  };
}
