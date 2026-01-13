/**
 * 请求限流中间件
 *
 * 限制每个 IP 地址的请求频率，防止滥用
 */

import type { Middleware } from "@dreamer/middleware";
import type { HttpContext } from "../context.ts";

/**
 * 限流配置选项
 */
export interface RateLimitOptions {
  /** 时间窗口（毫秒，默认：60000，即 1 分钟） */
  windowMs?: number;
  /** 每个时间窗口内的最大请求数（默认：100） */
  max?: number;
  /** 是否跳过成功响应的计数（默认：false） */
  skipSuccessfulRequests?: boolean;
  /** 是否跳过失败响应的计数（默认：false） */
  skipFailedRequests?: boolean;
  /** 自定义键生成函数（默认：使用 IP 地址） */
  keyGenerator?: (ctx: HttpContext) => string;
  /** 自定义跳过函数（默认：不跳过） */
  skip?: (ctx: HttpContext) => boolean;
  /** 达到限制时的响应消息（默认：Too Many Requests） */
  message?: string;
  /** 达到限制时的状态码（默认：429） */
  statusCode?: number;
}

/**
 * 限流记录
 */
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * 创建请求限流中间件
 *
 * @param options 限流配置选项
 * @returns 限流中间件函数
 *
 * @example
 * ```typescript
 * import { rateLimit } from "@dreamer/server";
 *
 * // 限制每分钟 100 个请求
 * app.use(rateLimit({
 *   windowMs: 60000,
 *   max: 100,
 * }));
 *
 * // 限制每个 IP 每分钟 10 个请求
 * app.use(rateLimit({
 *   windowMs: 60000,
 *   max: 10,
 * }));
 * ```
 */
/**
 * 限流中间件实例（包含清理方法）
 */
export interface RateLimitMiddleware extends Middleware<HttpContext> {
  /** 清理定时器（用于测试） */
  cleanup?: () => void;
}

export function rateLimit(
  options: RateLimitOptions = {},
): RateLimitMiddleware {
  const {
    windowMs = 60000, // 1 分钟
    max = 100,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = (ctx) => {
      // 默认使用 IP 地址
      const forwarded = ctx.headers.get("X-Forwarded-For");
      if (forwarded) {
        return forwarded.split(",")[0].trim();
      }
      const realIp = ctx.headers.get("X-Real-IP");
      if (realIp) {
        return realIp;
      }
      // 从 URL 获取主机名（作为后备）
      return ctx.url.hostname || "unknown";
    },
    skip = () => false,
    message = "Too Many Requests",
    statusCode = 429,
  } = options;

  // 存储限流记录（键 -> 记录）
  const store = new Map<string, RateLimitRecord>();

  // 定期清理过期的记录
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, windowMs);

  // 清理函数（用于测试）
  const cleanup = () => {
    clearInterval(cleanupInterval);
  };

  // 在 Node.js 环境中，process.on('exit') 可以清理定时器
  // 在 Deno/Bun 中，这个定时器会在进程退出时自动清理

  const middleware = async (
    ctx: HttpContext,
    next: () => Promise<void>,
  ): Promise<void> => {
    // 检查是否跳过
    if (skip(ctx)) {
      await next();
      return;
    }

    // 生成键
    const key = keyGenerator(ctx);

    // 获取或创建记录
    const now = Date.now();
    let record = store.get(key);

    if (!record || now > record.resetTime) {
      // 创建新记录
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
      store.set(key, record);
    }

    // 检查是否超过限制
    if (record.count >= max) {
      // 计算剩余时间
      const remaining = Math.ceil((record.resetTime - now) / 1000);

      // 设置响应头
      ctx.response = new Response(
        JSON.stringify({
          error: message,
          retryAfter: remaining,
        }),
        {
          status: statusCode,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": max.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(record.resetTime).toISOString(),
            "Retry-After": remaining.toString(),
          },
        },
      );
      return;
    }

    // 增加计数
    record.count++;

    // 执行下一个中间件
    await next();

    // 根据响应状态决定是否计数
    if (ctx.response) {
      const isSuccess = ctx.response.status >= 200 && ctx.response.status < 300;
      const isFailure = ctx.response.status >= 400;

      if (skipSuccessfulRequests && isSuccess) {
        // 跳过成功请求，减少计数
        record.count = Math.max(0, record.count - 1);
      } else if (skipFailedRequests && isFailure) {
        // 跳过失败请求，减少计数
        record.count = Math.max(0, record.count - 1);
      }

      // 设置响应头
      const remaining = Math.max(0, max - record.count);
      const headers = new Headers(ctx.response.headers);
      headers.set("X-RateLimit-Limit", max.toString());
      headers.set("X-RateLimit-Remaining", remaining.toString());
      headers.set(
        "X-RateLimit-Reset",
        new Date(record.resetTime).toISOString(),
      );
      ctx.response = new Response(ctx.response.body, {
        status: ctx.response.status,
        statusText: ctx.response.statusText,
        headers,
      });
    }
  };

  // 添加清理方法（用于测试）
  (middleware as RateLimitMiddleware).cleanup = cleanup;

  return middleware as RateLimitMiddleware;
}
