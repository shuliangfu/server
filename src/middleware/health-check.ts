/**
 * 健康检查中间件
 *
 * 提供健康检查端点，用于监控和负载均衡器
 */

import type { Middleware } from "@dreamer/middleware";
import type { HttpContext } from "../context.ts";

/**
 * 健康检查配置选项
 */
export interface HealthCheckOptions {
  /** 健康检查路径（默认：/health） */
  path?: string;
  /** 健康检查函数（可选，用于自定义健康检查逻辑） */
  check?: () => Promise<
    { healthy: boolean; details?: Record<string, unknown> }
  >;
}

/**
 * 创建健康检查中间件
 *
 * @param options 健康检查配置选项
 * @returns 健康检查中间件函数
 *
 * @example
 * ```typescript
 * import { healthCheck } from "@dreamer/server";
 *
 * // 使用默认配置
 * app.use(healthCheck());
 *
 * // 自定义路径和检查函数
 * app.use(healthCheck({
 *   path: "/healthz",
 *   check: async () => {
 *     // 检查数据库连接等
 *     return { healthy: true, details: { db: "connected" } };
 *   },
 * }));
 * ```
 */
export function healthCheck(
  options: HealthCheckOptions = {},
): Middleware<HttpContext> {
  const {
    path = "/health",
    check,
  } = options;

  return async (ctx: HttpContext, next: () => Promise<void>): Promise<void> => {
    // 只处理健康检查路径
    if (ctx.path !== path) {
      await next();
      return;
    }

    // 只处理 GET 请求
    if (ctx.method !== "GET" && ctx.method !== "HEAD") {
      await next();
      return;
    }

    try {
      // 如果有自定义检查函数，执行它
      if (check) {
        const result = await check();
        if (result.healthy) {
          // 如果有 details，返回 JSON，否则返回 "OK"
          const body = result.details
            ? JSON.stringify({
              status: "healthy",
              timestamp: new Date().toISOString(),
              ...result.details,
            })
            : "OK";
          ctx.response = new Response(
            body,
            {
              status: 200,
              headers: {
                "Content-Type": result.details
                  ? "application/json"
                  : "text/plain",
              },
            },
          );
        } else {
          ctx.response = new Response(
            JSON.stringify({
              status: "unhealthy",
              timestamp: new Date().toISOString(),
              ...result.details,
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
              },
            },
          );
        }
      } else {
        // 默认健康检查（总是返回健康）
        ctx.response = new Response(
          "OK",
          {
            status: 200,
            headers: {
              "Content-Type": "text/plain",
            },
          },
        );
      }
    } catch (error) {
      // 检查失败，返回不健康状态
      ctx.response = new Response(
        JSON.stringify({
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  };
}
