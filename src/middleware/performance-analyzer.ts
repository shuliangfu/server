/**
 * 开发模式性能分析中间件
 *
 * 在开发模式下收集性能数据，提供慢请求和慢中间件分析
 */

import type { Middleware } from "@dreamer/middleware";
import type { HttpContext } from "../context.ts";

/**
 * 中间件执行记录
 */
interface MiddlewareRecord {
  /** 中间件名称（如果有） */
  name?: string;
  /** 执行开始时间 */
  startTime: number;
  /** 执行结束时间 */
  endTime: number;
  /** 执行耗时（毫秒） */
  duration: number;
}

/**
 * 请求性能记录
 */
interface RequestRecord {
  /** 请求 ID */
  requestId: string;
  /** 请求方法 */
  method: string;
  /** 请求路径 */
  path: string;
  /** 请求 URL */
  url: string;
  /** 请求开始时间 */
  startTime: number;
  /** 请求结束时间 */
  endTime?: number;
  /** 总耗时（毫秒） */
  duration?: number;
  /** 响应状态码 */
  status?: number;
  /** 中间件执行记录 */
  middlewares: MiddlewareRecord[];
  /** 是否慢请求（超过阈值） */
  isSlow?: boolean;
}

/**
 * 性能分析配置选项
 */
export interface PerformanceAnalyzerOptions {
  /** 是否启用（默认：true，仅在开发模式） */
  enabled?: boolean;
  /** 慢请求阈值（毫秒，默认：1000） */
  slowRequestThreshold?: number;
  /** 慢中间件阈值（毫秒，默认：100） */
  slowMiddlewareThreshold?: number;
  /** 最大保留的记录数（默认：1000） */
  maxRecords?: number;
  /** 性能报告端点路径（默认：/__performance） */
  endpoint?: string;
  /** 是否在控制台输出慢请求警告（默认：true） */
  logSlowRequests?: boolean;
}

/**
 * 全局性能数据存储
 */
let performanceData: {
  /** 请求记录列表 */
  requests: RequestRecord[];
  /** 慢请求列表 */
  slowRequests: RequestRecord[];
  /** 中间件性能统计 */
  middlewareStats: Map<string, {
    count: number;
    totalTime: number;
    minTime: number;
    maxTime: number;
    avgTime: number;
  }>;
} = {
  requests: [],
  slowRequests: [],
  middlewareStats: new Map(),
};

/**
 * 生成请求 ID
 *
 * @returns 请求 ID
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 更新中间件统计
 *
 * @param name 中间件名称
 * @param duration 执行耗时
 */
function updateMiddlewareStats(name: string, duration: number): void {
  const stats = performanceData.middlewareStats.get(name) || {
    count: 0,
    totalTime: 0,
    minTime: Infinity,
    maxTime: 0,
    avgTime: 0,
  };

  stats.count++;
  stats.totalTime += duration;
  stats.minTime = Math.min(stats.minTime, duration);
  stats.maxTime = Math.max(stats.maxTime, duration);
  stats.avgTime = stats.totalTime / stats.count;

  performanceData.middlewareStats.set(name, stats);
}

/**
 * 添加请求记录
 *
 * @param record 请求记录
 * @param maxRecords 最大记录数
 */
function addRequestRecord(record: RequestRecord, maxRecords: number): void {
  performanceData.requests.push(record);

  // 限制记录数量
  if (performanceData.requests.length > maxRecords) {
    performanceData.requests.shift();
  }

  // 如果是慢请求，添加到慢请求列表
  if (record.isSlow) {
    performanceData.slowRequests.push(record);
    if (performanceData.slowRequests.length > maxRecords) {
      performanceData.slowRequests.shift();
    }
  }
}

/**
 * 生成性能报告 HTML
 *
 * @returns HTML 字符串
 */
function generatePerformanceReport(): string {
  const slowRequests = performanceData.slowRequests.slice(-20).reverse();
  const middlewareStats = Array.from(performanceData.middlewareStats.entries())
    .sort((a, b) => b[1].avgTime - a[1].avgTime)
    .slice(0, 20);

  return `<!DOCTYPE html>
<html>
<head>
  <title>性能分析报告</title>
  <style>
    body { font-family: monospace; margin: 20px; background: #1e1e1e; color: #d4d4d4; }
    h1, h2 { color: #4ec9b0; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #3e3e3e; padding: 8px; text-align: left; }
    th { background: #2d2d2d; color: #4ec9b0; }
    tr:nth-child(even) { background: #252526; }
    .slow { color: #f48771; }
    .fast { color: #4ec9b0; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .stat-card { background: #2d2d2d; padding: 15px; border-radius: 5px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #4ec9b0; }
    .stat-label { color: #858585; font-size: 12px; }
  </style>
</head>
<body>
  <h1>🚀 性能分析报告</h1>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-value">${performanceData.requests.length}</div>
      <div class="stat-label">总请求数</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${performanceData.slowRequests.length}</div>
      <div class="stat-label">慢请求数</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${performanceData.middlewareStats.size}</div>
      <div class="stat-label">中间件数</div>
    </div>
  </div>

  <h2>🐌 慢请求（最近 20 条）</h2>
  <table>
    <thead>
      <tr>
        <th>方法</th>
        <th>路径</th>
        <th>状态码</th>
        <th>耗时 (ms)</th>
        <th>中间件数</th>
        <th>时间</th>
      </tr>
    </thead>
    <tbody>
      ${
    slowRequests.map((req) => `
        <tr>
          <td>${req.method}</td>
          <td>${req.path}</td>
          <td>${req.status || "-"}</td>
          <td class="slow">${req.duration?.toFixed(2)}</td>
          <td>${req.middlewares.length}</td>
          <td>${new Date(req.startTime).toLocaleTimeString()}</td>
        </tr>
      `).join("")
  }
    </tbody>
  </table>

  <h2>⚡ 中间件性能统计（按平均耗时排序）</h2>
  <table>
    <thead>
      <tr>
        <th>中间件名称</th>
        <th>调用次数</th>
        <th>总耗时 (ms)</th>
        <th>最小耗时 (ms)</th>
        <th>最大耗时 (ms)</th>
        <th>平均耗时 (ms)</th>
      </tr>
    </thead>
    <tbody>
      ${
    middlewareStats.map(([name, stats]) => `
        <tr>
          <td>${name || "(未命名)"}</td>
          <td>${stats.count}</td>
          <td>${stats.totalTime.toFixed(2)}</td>
          <td>${
      stats.minTime === Infinity ? "-" : stats.minTime.toFixed(2)
    }</td>
          <td>${stats.maxTime.toFixed(2)}</td>
          <td class="${stats.avgTime > 100 ? "slow" : "fast"}">${
      stats.avgTime.toFixed(2)
    }</td>
        </tr>
      `).join("")
  }
    </tbody>
  </table>

  <script>
    // 自动刷新（每 5 秒）
    setTimeout(() => location.reload(), 5000);
  </script>
</body>
</html>`;
}

/**
 * 创建性能分析中间件
 *
 * @param options 配置选项
 * @returns 性能分析中间件函数
 *
 * @example
 * ```typescript
 * // 开发模式
 * if (mode === "dev") {
 *   app.use(performanceAnalyzer({
 *     slowRequestThreshold: 1000,
 *     logSlowRequests: true,
 *   }));
 * }
 * ```
 */
export function performanceAnalyzer(
  options: PerformanceAnalyzerOptions = {},
): Middleware<HttpContext> {
  const {
    enabled = true,
    slowRequestThreshold = 1000,
    slowMiddlewareThreshold = 100,
    maxRecords = 1000,
    endpoint = "/__performance",
    logSlowRequests = true,
  } = options;

  if (!enabled) {
    return async (_ctx, next) => await next();
  }

  return async (ctx: HttpContext, next: () => Promise<void>): Promise<void> => {
    // 处理性能报告端点
    if (ctx.path === endpoint && ctx.method === "GET") {
      ctx.response = new Response(generatePerformanceReport(), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
      return;
    }

    // 创建请求记录
    const requestId = generateRequestId();
    const startTime = performance.now();
    const record: RequestRecord = {
      requestId,
      method: ctx.method,
      path: ctx.path,
      url: ctx.url.toString(),
      startTime: Date.now(),
      middlewares: [],
    };

    // 包装 next 函数以跟踪中间件执行
    const originalNext = next;
    let middlewareIndex = 0;
    const wrappedNext = async (): Promise<void> => {
      const middlewareStartTime = performance.now();
      await originalNext();
      const middlewareEndTime = performance.now();
      const duration = middlewareEndTime - middlewareStartTime;

      // 记录中间件执行时间（如果有名称）
      const middlewareName = (ctx.state as any)?.middlewareName;
      if (middlewareName) {
        record.middlewares.push({
          name: middlewareName,
          startTime: middlewareStartTime,
          endTime: middlewareEndTime,
          duration,
        });

        // 更新中间件统计
        updateMiddlewareStats(middlewareName, duration);

        // 如果中间件执行慢，记录警告
        if (duration > slowMiddlewareThreshold && logSlowRequests) {
          console.warn(
            `[性能警告] 中间件 "${middlewareName}" 执行缓慢: ${
              duration.toFixed(2)
            }ms (路径: ${ctx.path})`,
          );
        }
      }

      middlewareIndex++;
    };

    // 执行中间件链
    try {
      await wrappedNext();
    } finally {
      // 记录请求完成信息
      const endTime = performance.now();
      const duration = endTime - startTime;

      record.endTime = Date.now();
      record.duration = duration;
      record.status = ctx.response?.status;

      // 判断是否为慢请求
      if (duration > slowRequestThreshold) {
        record.isSlow = true;

        if (logSlowRequests) {
          console.warn(
            `[性能警告] 慢请求: ${ctx.method} ${ctx.path} - ${
              duration.toFixed(2)
            }ms (状态码: ${record.status})`,
          );
        }
      }

      // 添加请求记录
      addRequestRecord(record, maxRecords);
    }
  };
}

/**
 * 获取性能统计数据
 *
 * @returns 性能统计数据
 */
export function getPerformanceStats(): {
  totalRequests: number;
  slowRequests: number;
  middlewareCount: number;
  requests: RequestRecord[];
  slowRequestsList: RequestRecord[];
  middlewareStats: Array<[string, {
    count: number;
    totalTime: number;
    minTime: number;
    maxTime: number;
    avgTime: number;
  }]>;
} {
  return {
    totalRequests: performanceData.requests.length,
    slowRequests: performanceData.slowRequests.length,
    middlewareCount: performanceData.middlewareStats.size,
    requests: [...performanceData.requests],
    slowRequestsList: [...performanceData.slowRequests],
    middlewareStats: Array.from(performanceData.middlewareStats.entries()),
  };
}

/**
 * 清空性能数据
 */
export function clearPerformanceData(): void {
  performanceData = {
    requests: [],
    slowRequests: [],
    middlewareStats: new Map(),
  };
}
