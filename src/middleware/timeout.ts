/**
 * 请求超时中间件
 *
 * 为请求设置超时时间，防止长时间运行的请求阻塞服务器
 */

import type { Middleware } from "@dreamer/middleware";
import type { HttpContext } from "../context.ts";

/**
 * 超时配置选项
 */
export interface TimeoutOptions {
  /** 超时时间（毫秒，默认：30000，即 30 秒） */
  timeout?: number;
  /** 超时时的响应消息（默认：Request Timeout） */
  message?: string;
  /** 超时时的状态码（默认：408） */
  statusCode?: number;
  /** 自定义跳过函数（默认：不跳过） */
  skip?: (ctx: HttpContext) => boolean;
}

/**
 * 创建请求超时中间件
 *
 * @param options 超时配置选项
 * @returns 超时中间件函数
 *
 * @example
 * ```typescript
 * import { timeout } from "@dreamer/server";
 *
 * // 设置 30 秒超时
 * app.use(timeout({
 *   timeout: 30000,
 * }));
 *
 * // 设置 5 分钟超时
 * app.use(timeout({
 *   timeout: 300000,
 * }));
 * ```
 */
export function timeout(
  options: TimeoutOptions = {},
): Middleware<HttpContext> {
  const {
    timeout: timeoutMs = 30000, // 30 秒
    message = "Request Timeout",
    statusCode = 408,
    skip = () => false,
  } = options;

  return async (ctx: HttpContext, next: () => Promise<void>): Promise<void> => {
    // 检查是否跳过
    if (skip(ctx)) {
      await next();
      return;
    }

    // 创建超时 Promise，并保存定时器 ID 以便清理
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isTimeout = false;
    const timeoutPromise = new Promise<void>((resolve) => {
      timeoutId = setTimeout(() => {
        isTimeout = true;
        resolve();
      }, timeoutMs);
    });

    // 创建执行 Promise
    const executePromise = (async () => {
      await next();
    })();

    // 使用 Promise.race 实现超时
    try {
      await Promise.race([executePromise, timeoutPromise]);
    } catch (error) {
      // 如果执行出错，清理定时器并继续抛出
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      throw error;
    } finally {
      // 无论哪个 Promise 先完成，都清理定时器
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }

    // 检查是否超时
    // 如果超时，设置超时响应（无论 ctx.response 是否存在）
    if (isTimeout) {
      // 如果超时，设置超时响应
      ctx.response = new Response(
        JSON.stringify({
          error: message,
          timeout: timeoutMs,
        }),
        {
          status: statusCode,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  };
}
