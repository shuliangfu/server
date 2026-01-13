/**
 * Request ID 追踪中间件
 *
 * 为每个请求生成唯一 ID，便于日志追踪和问题排查
 */

import type { Middleware } from "@dreamer/middleware";
import type { HttpContext } from "../context.ts";

/**
 * Request ID 配置选项
 */
export interface RequestIdOptions {
  /** 请求头名称（默认：X-Request-ID） */
  headerName?: string;
  /** 是否在响应头中包含 Request ID（默认：true） */
  includeInResponse?: boolean;
  /** 自定义 ID 生成函数（默认：使用 crypto.randomUUID()） */
  generateId?: () => string;
  /** 是否从请求头中读取 Request ID（如果存在）（默认：true） */
  readFromHeader?: boolean;
}

/**
 * 创建 Request ID 中间件
 *
 * @param options 配置选项
 * @returns Request ID 中间件函数
 *
 * @example
 * ```typescript
 * app.use(requestId());
 *
 * // 自定义配置
 * app.use(requestId({
 *   headerName: "X-Correlation-ID",
 *   includeInResponse: true,
 * }));
 * ```
 */
export function requestId(
  options: RequestIdOptions = {},
): Middleware<HttpContext> {
  const {
    headerName = "X-Request-ID",
    includeInResponse = true,
    generateId = () => globalThis.crypto.randomUUID(),
    readFromHeader = true,
  } = options;

  return async (ctx: HttpContext, next: () => Promise<void>): Promise<void> => {
    // 尝试从请求头中读取 Request ID
    let requestId: string;
    if (readFromHeader) {
      const existingId = ctx.headers.get(headerName);
      if (existingId) {
        requestId = existingId;
      } else {
        requestId = generateId();
        // 将 Request ID 添加到请求头中（供后续中间件使用）
        ctx.headers.set(headerName, requestId);
      }
    } else {
      requestId = generateId();
      ctx.headers.set(headerName, requestId);
    }

    // 将 Request ID 存储到 context 中（供后续中间件和路由处理器使用）
    (ctx as any).requestId = requestId;

    // 继续处理请求
    await next();

    // 在响应头中包含 Request ID（如果启用）
    if (includeInResponse && ctx.response) {
      const headers = new Headers(ctx.response.headers);
      headers.set(headerName, requestId);
      ctx.response = new Response(ctx.response.body, {
        status: ctx.response.status,
        statusText: ctx.response.statusText,
        headers,
      });
    }
  };
}
