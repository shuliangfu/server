/**
 * Cookie 管理模块
 *
 * 提供 Cookie 解析和设置功能
 */

import type { CookieOptions } from "./context.ts";

/**
 * 解析 Cookie 请求头
 *
 * @param cookieHeader Cookie 请求头字符串（从 Request.headers.get("Cookie") 获取）
 * @returns Cookie 键值对对象
 *
 * @example
 * ```typescript
 * const cookies = parseCookie("name1=value1; name2=value2");
 * // { name1: "value1", name2: "value2" }
 * ```
 */
export function parseCookie(
  cookieHeader: string | null,
): Record<string, string> {
  const cookies: Record<string, string> = {};

  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader.split(";").forEach((cookie) => {
    const trimmed = cookie.trim();
    if (!trimmed) {
      return;
    }

    const [name, ...valueParts] = trimmed.split("=");
    if (name && valueParts.length > 0) {
      const value = valueParts.join("=").trim(); // 处理值中包含 = 的情况，并 trim 空格
      try {
        cookies[name.trim()] = decodeURIComponent(value);
      } catch {
        // 如果解码失败，使用原始值
        cookies[name.trim()] = value;
      }
    }
  });

  return cookies;
}

/**
 * 序列化 Cookie 为 Set-Cookie 头格式
 *
 * @param name Cookie 名称
 * @param value Cookie 值
 * @param options Cookie 选项
 * @returns Set-Cookie 头字符串
 *
 * @example
 * ```typescript
 * const cookieString = serializeCookie("sessionId", "abc123", {
 *   maxAge: 3600000,
 *   httpOnly: true,
 *   secure: true,
 *   sameSite: "strict"
 * });
 * // "sessionId=abc123; Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=Strict"
 * ```
 */
export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
): string {
  const parts: string[] = [`${name}=${encodeURIComponent(value)}`];

  // Max-Age（优先级高于 Expires）
  // 注意：maxAge 应该是秒数，如果传入的是毫秒，需要转换
  if (options.maxAge !== undefined) {
    // 如果 maxAge 大于 1000000，可能是毫秒，转换为秒
    const maxAgeSeconds = options.maxAge > 1000000
      ? Math.floor(options.maxAge / 1000)
      : options.maxAge;
    parts.push(`Max-Age=${maxAgeSeconds}`);
  }

  // Expires
  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  // Domain
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  // Path（只有明确指定时才添加）
  if (options.path !== undefined) {
    parts.push(`Path=${options.path}`);
  }

  // Secure
  if (options.secure) {
    parts.push("Secure");
  }

  // HttpOnly
  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  // SameSite
  if (options.sameSite) {
    // SameSite 值需要首字母大写
    const sameSiteValue = options.sameSite.charAt(0).toUpperCase() +
      options.sameSite.slice(1).toLowerCase();
    parts.push(`SameSite=${sameSiteValue}`);
  }

  return parts.join("; ");
}

/**
 * Cookie 管理器类
 * 用于在 HTTP 请求处理中管理 Cookie
 */
export class CookieManager {
  /** 请求中的 Cookie（从请求头解析） */
  private requestCookies: Record<string, string> = {};

  /** 响应中要设置的 Cookie */
  private responseCookies: Map<
    string,
    { value: string; options?: CookieOptions }
  > = new Map();

  /**
   * 创建 Cookie 管理器
   *
   * @param cookieHeader Cookie 请求头字符串
   */
  constructor(cookieHeader: string | null) {
    this.requestCookies = parseCookie(cookieHeader);
  }

  /**
   * 获取 Cookie 值
   * 优先从响应 Cookie 中获取（如果已设置），否则从请求 Cookie 中获取
   *
   * @param name Cookie 名称
   * @returns Cookie 值，如果不存在或已删除返回 undefined
   */
  get(name: string): string | undefined {
    // 优先从响应 Cookie 中获取（如果已设置）
    const responseCookie = this.responseCookies.get(name);
    if (responseCookie) {
      // 如果值是空字符串，表示已删除，返回 undefined
      if (responseCookie.value === "") {
        return undefined;
      }
      return responseCookie.value;
    }
    // 否则从请求 Cookie 中获取
    return this.requestCookies[name];
  }

  /**
   * 设置 Cookie
   *
   * @param name Cookie 名称
   * @param value Cookie 值
   * @param options Cookie 选项
   */
  set(name: string, value: string, options?: CookieOptions): void {
    this.responseCookies.set(name, { value, options });
  }

  /**
   * 删除 Cookie
   * 通过设置过期时间为 0 来删除 Cookie
   *
   * @param name Cookie 名称
   */
  remove(name: string): void {
    this.set(name, "", {
      maxAge: 0,
      expires: new Date(0),
    });
  }

  /**
   * 获取所有 Cookie
   * 合并请求 Cookie 和响应 Cookie（响应 Cookie 优先级更高）
   *
   * @returns 所有 Cookie 的键值对
   */
  getAll(): Record<string, string> {
    const all: Record<string, string> = { ...this.requestCookies };
    // 合并响应 Cookie（优先级更高）
    for (const [name, { value }] of this.responseCookies) {
      all[name] = value;
    }
    return all;
  }

  /**
   * 将 Cookie 应用到响应头
   *
   * @param response 响应对象
   * @returns 新的响应对象（包含 Set-Cookie 头）
   */
  applyToResponse(response: Response): Response {
    const headers = new Headers(response.headers);

    // 添加所有设置的 Cookie
    for (const [name, { value, options }] of this.responseCookies) {
      const cookieString = serializeCookie(name, value, options);
      headers.append("Set-Cookie", cookieString);
    }

    // 创建新的响应对象
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
