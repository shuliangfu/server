/**
 * 请求日志中间件
 *
 * 记录请求信息、响应信息、错误信息
 */

import type { Middleware } from "@dreamer/middleware";
import type { Logger, LogLevel } from "@dreamer/logger";
import { createLogger } from "@dreamer/logger";
import type { HttpContext } from "../context.ts";

/**
 * 请求日志配置选项
 */
export interface RequestLoggerOptions {
  /** Logger 实例（可选，如果提供则使用，否则创建默认 logger） */
  logger?: Logger;
  /** 日志级别（默认：info） */
  level?: LogLevel;
  /** 日志格式（默认：text） */
  format?: "json" | "text";
  /** 是否包含请求头 */
  includeHeaders?: boolean;
  /** 是否包含请求体 */
  includeBody?: boolean;
}

/**
 * 创建请求日志中间件
 *
 * @param options 请求日志配置选项
 * @returns 请求日志中间件函数
 *
 * @example
 * ```typescript
 * app.use(requestLogger({
 *   level: "info",
 *   includeHeaders: true,
 * }));
 * ```
 */
export function requestLogger(
  options: RequestLoggerOptions = {},
): Middleware<HttpContext> {
  const {
    logger = createLogger(),
    level = "info",
    format = "text",
    includeHeaders = false,
    includeBody = false,
  } = options;

  return async (ctx: HttpContext, next: () => Promise<void>): Promise<void> => {
    const startTime = Date.now();

    // 记录请求信息
    const requestInfo: Record<string, unknown> = {
      method: ctx.method,
      path: ctx.path,
      query: ctx.query,
    };

    if (includeHeaders) {
      const headers: Record<string, string> = {};
      ctx.headers.forEach((value, key) => {
        headers[key] = value;
      });
      requestInfo.headers = headers;
    }

    if (includeBody && ctx.body) {
      requestInfo.body = ctx.body;
    }

    if (format === "json") {
      logger[level](JSON.stringify({ type: "request", ...requestInfo }));
    } else {
      logger[level](
        `${ctx.method} ${ctx.path}${ctx.query ? `?${new URLSearchParams(ctx.query).toString()}` : ""}`,
      );
    }

    // 执行下一个中间件
    await next();

    // 记录响应信息
    const duration = Date.now() - startTime;
    const status = ctx.response?.status || 500;

    const responseInfo: Record<string, unknown> = {
      method: ctx.method,
      path: ctx.path,
      status,
      duration: `${duration}ms`,
    };

    if (format === "json") {
      logger[level](JSON.stringify({ type: "response", ...responseInfo }));
    } else {
      logger[level](
        `${ctx.method} ${ctx.path} ${status} ${duration}ms`,
      );
    }
  };
}
