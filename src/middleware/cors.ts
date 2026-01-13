/**
 * CORS 中间件
 *
 * 处理跨域请求
 */

import type { Middleware } from "@dreamer/middleware";
import type { HttpContext } from "../context.ts";

/**
 * CORS 配置选项
 */
export interface CorsOptions {
  /** 允许的源（字符串、字符串数组或函数） */
  origin?: string | string[] | ((origin: string) => boolean);
  /** 允许的 HTTP 方法 */
  methods?: string[];
  /** 允许的请求头 */
  allowedHeaders?: string[];
  /** 暴露的响应头 */
  exposedHeaders?: string[];
  /** 是否允许携带凭证 */
  credentials?: boolean;
  /** 预检请求的缓存时间（秒） */
  maxAge?: number;
}

/**
 * 创建 CORS 中间件
 *
 * @param options CORS 配置选项
 * @returns CORS 中间件函数
 *
 * @example
 * ```typescript
 * app.use(cors({
 *   origin: "https://example.com",
 *   credentials: true,
 * }));
 * ```
 */
export function cors(options: CorsOptions = {}): Middleware<HttpContext> {
  const {
    origin = "*",
    methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders = ["Content-Type", "Authorization"],
    exposedHeaders = [],
    credentials = false,
    maxAge,
  } = options;

  return async (ctx: HttpContext, next: () => Promise<void>): Promise<void> => {
    const requestOrigin = ctx.headers.get("Origin");

    // 处理 OPTIONS 预检请求
    if (ctx.method === "OPTIONS") {
      const headers = new Headers();

      // 设置 Access-Control-Allow-Origin
      if (requestOrigin && isOriginAllowed(requestOrigin, origin)) {
        headers.set("Access-Control-Allow-Origin", requestOrigin);
      } else if (origin === "*") {
        headers.set("Access-Control-Allow-Origin", "*");
      }

      // 设置 Access-Control-Allow-Methods
      headers.set("Access-Control-Allow-Methods", methods.join(", "));

      // 设置 Access-Control-Allow-Headers
      const requestedHeaders = ctx.headers.get(
        "Access-Control-Request-Headers",
      );
      if (requestedHeaders) {
        headers.set("Access-Control-Allow-Headers", requestedHeaders);
      } else {
        headers.set("Access-Control-Allow-Headers", allowedHeaders.join(", "));
      }

      // 设置 Access-Control-Expose-Headers
      if (exposedHeaders.length > 0) {
        headers.set("Access-Control-Expose-Headers", exposedHeaders.join(", "));
      }

      // 设置 Access-Control-Allow-Credentials
      if (credentials) {
        headers.set("Access-Control-Allow-Credentials", "true");
      }

      // 设置 Access-Control-Max-Age
      if (maxAge !== undefined) {
        headers.set("Access-Control-Max-Age", String(maxAge));
      }

      ctx.response = new Response(null, { status: 204, headers });
      return;
    }

    // 处理普通请求
    await next();

    if (ctx.response) {
      const headers = new Headers(ctx.response.headers);

      // 设置 Access-Control-Allow-Origin
      if (requestOrigin && isOriginAllowed(requestOrigin, origin)) {
        headers.set("Access-Control-Allow-Origin", requestOrigin);
      } else if (origin === "*") {
        headers.set("Access-Control-Allow-Origin", "*");
      }

      // 设置 Access-Control-Expose-Headers
      if (exposedHeaders.length > 0) {
        headers.set("Access-Control-Expose-Headers", exposedHeaders.join(", "));
      }

      // 设置 Access-Control-Allow-Credentials
      if (credentials) {
        headers.set("Access-Control-Allow-Credentials", "true");
      }

      ctx.response = new Response(ctx.response.body, {
        status: ctx.response.status,
        statusText: ctx.response.statusText,
        headers,
      });
    }
  };
}

/**
 * 检查源是否被允许
 *
 * @param requestOrigin 请求的源
 * @param allowedOrigin 允许的源配置
 * @returns 是否允许
 */
function isOriginAllowed(
  requestOrigin: string,
  allowedOrigin: string | string[] | ((origin: string) => boolean),
): boolean {
  if (typeof allowedOrigin === "string") {
    return requestOrigin === allowedOrigin;
  }

  if (Array.isArray(allowedOrigin)) {
    return allowedOrigin.includes(requestOrigin);
  }

  if (typeof allowedOrigin === "function") {
    return allowedOrigin(requestOrigin);
  }

  return false;
}
