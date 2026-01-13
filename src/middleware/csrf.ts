/**
 * CSRF 保护中间件
 *
 * 防止跨站请求伪造（CSRF）攻击
 * 使用 Double Submit Cookie 模式
 */

import type { Middleware } from "@dreamer/middleware"
import type { HttpContext } from "../context.ts"

/**
 * CSRF Token 生成函数类型
 */
export type CsrfTokenGenerator = () => string;

/**
 * CSRF 保护配置选项
 */
export interface CsrfOptions {
  /** Cookie 名称（默认：_csrf） */
  cookieName?: string;
  /** 请求头名称（默认：X-CSRF-Token） */
  headerName?: string;
  /** 表单字段名称（默认：_csrf） */
  fieldName?: string;
  /** Cookie 选项 */
  cookieOptions?: {
    /** 是否只在 HTTPS 下发送（默认：true） */
    secure?: boolean;
    /** 是否禁止 JavaScript 访问（默认：true） */
    httpOnly?: boolean;
    /** SameSite 策略（默认：strict） */
    sameSite?: "strict" | "lax" | "none";
    /** 路径（默认：/） */
    path?: string;
    /** 域名 */
    domain?: string;
  };
  /** Token 生成函数（默认：生成 32 字节的随机字符串） */
  tokenGenerator?: CsrfTokenGenerator;
  /** 判断是否应该跳过 CSRF 检查的函数（默认：跳过 GET、HEAD、OPTIONS） */
  shouldSkip?: (ctx: HttpContext) => boolean;
  /** 判断是否应该验证的函数（默认：验证 POST、PUT、DELETE、PATCH） */
  shouldVerify?: (ctx: HttpContext) => boolean;
  /** 错误消息（默认：Forbidden: CSRF token mismatch） */
  errorMessage?: string;
}

/**
 * 生成随机 Token
 *
 * @param length Token 长度（默认：32）
 * @returns 随机 Token 字符串
 */
function generateRandomToken(length: number = 32): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 默认判断是否应该跳过 CSRF 检查
 * 安全方法（GET、HEAD、OPTIONS）不需要 CSRF 保护
 *
 * @param ctx HTTP 上下文
 * @returns 是否应该跳过
 */
function defaultShouldSkip(ctx: HttpContext): boolean {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  return safeMethods.includes(ctx.method);
}

/**
 * 默认判断是否应该验证 CSRF Token
 * 非安全方法需要验证
 *
 * @param ctx HTTP 上下文
 * @returns 是否应该验证
 */
function defaultShouldVerify(ctx: HttpContext): boolean {
  return !defaultShouldSkip(ctx);
}

/**
 * 从请求中获取 CSRF Token
 * 优先级：请求头 > 表单字段 > 查询参数
 *
 * @param ctx HTTP 上下文
 * @param headerName 请求头名称
 * @param fieldName 表单字段名称
 * @returns CSRF Token，如果不存在返回 null
 */
function getTokenFromRequest(
  ctx: HttpContext,
  headerName: string,
  fieldName: string,
): string | null {
  // 从请求头获取
  const headerToken = ctx.headers.get(headerName);
  if (headerToken) {
    return headerToken;
  }

  // 从表单字段获取（如果 body 是对象）
  if (ctx.body && typeof ctx.body === "object") {
    const body = ctx.body as Record<string, unknown>;
    if (body[fieldName] && typeof body[fieldName] === "string") {
      return body[fieldName] as string;
    }
  }

  // 从查询参数获取（不推荐，但支持）
  if (ctx.query && ctx.query[fieldName]) {
    return ctx.query[fieldName];
  }

  return null;
}

/**
 * 创建 CSRF 保护中间件
 *
 * @param options CSRF 配置选项
 * @returns CSRF 保护中间件函数
 *
 * @example
 * ```typescript
 * app.use(csrf({
 *   cookieName: "_csrf",
 *   headerName: "X-CSRF-Token",
 * }));
 * ```
 */
export function csrf(options: CsrfOptions = {}): Middleware<HttpContext> {
  const {
    cookieName = "_csrf",
    headerName = "X-CSRF-Token",
    fieldName = "_csrf",
    cookieOptions = {},
    tokenGenerator = () => generateRandomToken(32),
    shouldSkip = defaultShouldSkip,
    shouldVerify = defaultShouldVerify,
    errorMessage = "Forbidden: CSRF token mismatch",
  } = options;

  const {
    secure = true,
    httpOnly = true,
    sameSite = "strict",
    path = "/",
    domain,
  } = cookieOptions;

  return async (ctx: HttpContext, next: () => Promise<void>): Promise<void> => {
    // 获取 Cookie 中的 Token
    const cookieToken = ctx.cookies.get(cookieName);

    // 如果 Cookie 中没有 Token，生成并设置新的 Token（无论是否跳过验证）
    if (!cookieToken) {
      const newToken = tokenGenerator();
      ctx.cookies.set(cookieName, newToken, {
        secure,
        httpOnly,
        sameSite,
        path,
        domain,
      });
    }

    // 如果应该跳过，直接执行下一个中间件
    if (shouldSkip(ctx)) {
      await next();
      return;
    }

    // 如果应该验证，检查 Token 是否匹配
    if (shouldVerify(ctx)) {
      const requestToken = getTokenFromRequest(ctx, headerName, fieldName);
      // 重新获取 Token（可能刚刚被设置）
      const tokenToVerify = ctx.cookies.get(cookieName);

      if (!requestToken || !tokenToVerify || requestToken !== tokenToVerify) {
        ctx.response = new Response(
          JSON.stringify({
            error: {
              code: "CSRF_TOKEN_MISMATCH",
              message: errorMessage,
              status: 403,
            },
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
        return;
      }
    }

    // 验证通过，继续执行下一个中间件
    await next();
  };
}
