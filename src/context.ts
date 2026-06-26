/**
 * 上下文类型与工厂
 *
 * 本文件集中包含：
 * - **Http 层**：`HttpContext` 等（含 `request` / `path` / `url` 等）；
 * - **从 URL/头推导的常用字段**：`pathnameFromHref`、`searchFromHref`、`requestId`、
 *   `clientIp`、路由快照等，供 `LoadContext` / `ApiRouteContext` 与 dweb 对齐；
 * - **API 文件路由**：`ServerResponse`、`ApiRouteContext` / `ApiContext`、`buildApiRouteContext`。
 *
 * @module
 */

import type { MiddlewareContext } from "@dreamer/middleware";

import { parseCookie } from "./cookie.ts";

// ============================================================================
// HTTP 请求侧：HttpContext（中间件与服务端路由共用）
// ============================================================================

/**
 * HTTP 错误接口
 */
export interface HttpError {
  /** HTTP 状态码 */
  status: number;
  /** 错误消息 */
  message: string;
  /** 错误代码（可选） */
  code?: string;
  /** 错误详情（可选） */
  details?: unknown;
  /** 时间戳 */
  timestamp?: string;
  /** 索引签名（用于兼容 MiddlewareContext） */
  [key: string]: unknown;
}

/**
 * Cookie 选项接口
 */
export interface CookieOptions {
  /** 过期时间（毫秒） */
  maxAge?: number;
  /** 过期日期 */
  expires?: Date;
  /** 域名 */
  domain?: string;
  /** 路径（默认：/） */
  path?: string;
  /** 是否只在 HTTPS 下发送 */
  secure?: boolean;
  /** 是否禁止 JavaScript 访问 */
  httpOnly?: boolean;
  /** SameSite 策略 */
  sameSite?: "strict" | "lax" | "none";
}

/**
 * HTTP 上下文接口
 * 继承自 MiddlewareContext，扩展 HTTP 特定属性
 *
 * 注意：索引签名 [key: string]: unknown 允许动态添加属性（如 session）
 */
export interface HttpContext extends MiddlewareContext {
  /** 原始请求对象 */
  request: Request;
  /** 响应对象（中间件可以修改） */
  response?: Response;
  /** 请求路径 */
  path: string;
  /** HTTP 方法 */
  method: string;
  /** URL 对象 */
  url: URL;
  /** 请求头 */
  headers: Headers;
  /** 路由参数（由路由系统填充） */
  params?: Record<string, string>;
  /** 查询参数（从 URL 解析） */
  query?: Record<string, string>;
  /** 解析后的请求体 */
  body?: unknown;
  /** 错误信息 */
  error?: HttpError;

  /** Cookie 操作 */
  cookies: {
    /**
     * 获取 Cookie 值
     * @param name Cookie 名称
     * @returns Cookie 值，如果不存在返回 undefined
     */
    get(name: string): string | undefined;

    /**
     * 设置 Cookie
     * @param name Cookie 名称
     * @param value Cookie 值
     * @param options Cookie 选项
     */
    set(name: string, value: string, options?: CookieOptions): void;

    /**
     * 删除 Cookie（通过设置过期时间）
     * @param name Cookie 名称
     */
    remove(name: string): void;

    /**
     * 获取所有 Cookie
     * @returns 所有 Cookie 的键值对
     */
    getAll(): Record<string, string>;
  };

  // 注意：session 属性由 @dreamer/session 库通过模块增强添加
  // 索引签名允许运行时动态添加属性
}

// ============================================================================
// 从 HTTP 请求推导 LoadContext / ApiRouteContext 常用字段
// ============================================================================

/** 规范化 pathname：去掉末尾 `/`，根路径保持 `/`（与浏览器常见用法一致） */
function normalizePathnameSegment(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/**
 * 从任意 URL / 路径字符串解析 pathname 并规范化。
 *
 * @param href - 绝对 URL、或以 `/` 开头的路径（可含 query）
 */
export function pathnameFromHref(href: string): string {
  try {
    const u = new URL(href, "http://127.0.0.1/");
    return normalizePathnameSegment(u.pathname);
  } catch {
    return "/";
  }
}

/**
 * 从任意 URL / 路径字符串解析 `URL.search`（含 `?`，无查询参数时为 `""`）。
 *
 * @param href - 完整或相对请求 URL
 */
export function searchFromHref(href: string): string {
  try {
    return new URL(href, "http://127.0.0.1/").search;
  } catch {
    return "";
  }
}

/**
 * 解析链路 ID：优先沿用入口代理传入的 **`x-request-id`** / **`x-correlation-id`**，
 * 否则生成新的 **`crypto.randomUUID()`**。
 *
 * @param headers - 请求头
 */
export function resolveRequestId(headers: Headers): string {
  const fromHeader = headers.get("x-request-id")?.trim() ||
    headers.get("x-correlation-id")?.trim();
  if (fromHeader) return fromHeader;
  return crypto.randomUUID();
}

/**
 * 尽力解析「客户端 IP」：**仅基于常见代理头**，结果不可视为绝对可信；
 * 生产环境需在反向代理侧正确改写 **`x-forwarded-for`**。
 *
 * 优先级：`x-forwarded-for`（取第一段）→ **`cf-connecting-ip`** → **`true-client-ip`**。
 *
 * @param headers - 请求头
 * @returns 解析到的字符串，否则 `undefined`
 */
export function resolveClientIp(headers: Headers): string | undefined {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const tc = headers.get("true-client-ip")?.trim();
  if (tc) return tc;
  return undefined;
}

/**
 * 路由匹配快照：便于 `load`/API 内做观测、调试或按路由配置分支（不包含 meta 等大型字段）。
 */
export interface MatchedRouteSnapshot {
  /** 路由 pattern，如 `/user/:id` */
  path: string;
  /** 相对于 routes 目录的文件路径 */
  file: string;
  /** 磁盘完整路径（构建/扫描产出） */
  fullPath: string;
  /** 是否为 API 路由 */
  isApi: boolean;
}

/**
 * 从 `@dreamer/router` 的 `Route`（或等价形状）构造 {@link MatchedRouteSnapshot}。
 *
 * @param route - 匹配到的路由条目
 */
export function snapshotMatchedRoute(route: {
  path: string;
  file: string;
  fullPath: string;
  isApi: boolean;
}): MatchedRouteSnapshot {
  return {
    path: route.path,
    file: route.file,
    fullPath: route.fullPath,
    isApi: route.isApi,
  };
}

// ============================================================================
// API 文件路由：`ServerResponse`、`ApiRouteContext`、`buildApiRouteContext`
// ============================================================================

/**
 * 服务端响应辅助：与 dweb `createServerResponse` 行为一致；`json()` 统一封装为 `{ success, data }`
 */
export interface ServerResponse {
  redirect(url: string, status?: number): Response;
  /**
   * 返回 JSON 响应（Content-Type: application/json）。
   * 将业务载荷 `data` 统一封装为 `{ success, data }`：
   * - `success`：由 `init.status` 推断（默认 `200`）；**2xx** 为 `true`，否则为 `false`。
   * - `data`：第一参传入的对象或其它可序列化值；未传时为 `null`。
   *
   * @param data 业务数据，例如 `{ message: "登录成功" }` 或 `{ error: "email_and_password_required" }`
   * @param init 可选 `ResponseInit`，常用 `{ status: 400 }` 等表示失败
   */
  json(data: unknown, init?: ResponseInit): Response;
  html(body: string, init?: ResponseInit): Response;
  text(body: string, init?: ResponseInit): Response;
  binary(data: Uint8Array | ArrayBuffer, init?: ResponseInit): Response;
  body(
    body: string | ReadableStream<Uint8Array> | Blob | ArrayBuffer | null,
    init?: ResponseInit,
  ): Response;
  status(code: number, statusText?: string): Response;
  /**
   * 取出 handler 内最后一次 res.* 生成的 Response（action 模式常见未 return）
   * 仅供 {@link RouterAdapter} 使用
   */
  takeLastResponse?(): Response | null;
}

const JSON_HEADERS = new Headers({
  "Content-Type": "application/json; charset=utf-8",
});
const HTML_HEADERS = new Headers({
  "Content-Type": "text/html; charset=utf-8",
});
const TEXT_HEADERS = new Headers({
  "Content-Type": "text/plain; charset=utf-8",
});
const BINARY_HEADERS = new Headers({
  "Content-Type": "application/octet-stream",
});

/**
 * 创建与 dweb `createServerResponse` 一致的响应助手（纯 Web Response）
 */
export function createServerResponse(): ServerResponse {
  /** 记录最后一次 res.* 返回值，供 handler 未 return 时恢复响应 */
  let lastResponse: Response | null = null;
  const track = (response: Response): Response => {
    lastResponse = response;
    return response;
  };
  return {
    redirect(url: string, status = 302): Response {
      return track(
        new Response(null, {
          status,
          headers: new Headers({ Location: url }),
        }),
      );
    },
    json(data: unknown, init?: ResponseInit): Response {
      // HTTP 状态码决定 success；业务载荷一律放在 data，与 @dreamer/dweb createServerResponse 保持一致
      const status = init?.status ?? 200;
      const success = status >= 200 && status < 300;
      const envelope = {
        success,
        data: data === undefined ? null : data,
      };
      const body = JSON.stringify(envelope);
      const headers = new Headers(init?.headers ?? JSON_HEADERS);
      return track(new Response(body, { ...init, headers }));
    },
    html(body: string, init?: ResponseInit): Response {
      const headers = new Headers(init?.headers ?? HTML_HEADERS);
      return track(new Response(body, { ...init, headers }));
    },
    text(body: string, init?: ResponseInit): Response {
      const headers = new Headers(init?.headers ?? TEXT_HEADERS);
      return track(new Response(body, { ...init, headers }));
    },
    binary(data: Uint8Array | ArrayBuffer, init?: ResponseInit): Response {
      const headers = new Headers(init?.headers ?? BINARY_HEADERS);
      return track(new Response(data as BodyInit, { ...init, headers }));
    },
    body(
      body: string | ReadableStream<Uint8Array> | Blob | ArrayBuffer | null,
      init?: ResponseInit,
    ): Response {
      return track(new Response(body, init));
    },
    status(code: number, statusText?: string): Response {
      return track(new Response(null, { status: code, statusText }));
    },
    takeLastResponse(): Response | null {
      const response = lastResponse;
      lastResponse = null;
      return response;
    },
  };
}

/**
 * API 文件路由唯一参数上下文（由 {@link buildApiRouteContext} 注入）。
 *
 * 与 `@dreamer/dweb` 的 {@link LoadContext} 一致：在 {@link HttpContext} 上省略 **`response`**，
 * 用 **`url`（字符串）**、**`cookies`（Record）** 替代 `HttpContext` 中对应字段；其余 **`HttpContext`**
 * 字段保留。使用 **`req` / `res`** 命名；**`req`** 与 **`request`** 为同一 {@link Request}。
 * **`body`** 仍继承自 `HttpContext`：JSON 请求时可能由 {@link RouterAdapter} 预解析后写入。
 */
export type ApiRouteContext =
  & Omit<HttpContext, "cookies" | "url" | "response">
  & {
    /** HTTP 方法（与 {@link HttpContext.method} 一致；显式写出以避免与索引签名相交后变窄异常） */
    method: string;
    /** 当前请求完整 URL 字符串（通常为 `URL.href`） */
    url: string;
    /** Cookie 快照（替代 `HttpContext.cookies` 方法对象） */
    cookies: Record<string, string>;
    /** 路由动态参数（框架注入） */
    params: Record<string, string>;
    /** 查询参数（框架注入） */
    query: Record<string, string>;
    /** 规范化 pathname（与 dweb `LoadContext.pathname` 一致） */
    pathname: string;
    /** URL 的 `search` 段（含 `?`） */
    search: string;
    /** 链路 ID */
    requestId: string;
    /** 尽力推断的客户端地址 */
    clientIp?: string;
    /** 匹配路由快照 */
    matchedRoute?: MatchedRouteSnapshot;
    /** 与 {@link HttpContext.request} 相同引用 */
    req: Request;
    /** redirect / json / html 等（API 路由必填） */
    res: ServerResponse;
    /** 由 session 中间件等挂载时存在 */
    session?: unknown;
  };

/**
 * {@link ApiRouteContext} 别名（与 `@dreamer/dweb` 的 `LoadContext` / `ApiContext` 字段名一致：`req` / `res`）。
 */
export type ApiContext = ApiRouteContext;

/**
 * 从 HttpContext 与路由参数构造 API 处理器唯一参数（ApiRouteContext / ApiContext）
 *
 * @param ctx HTTP 上下文（含 request、url、method 等）
 * @param params 路由匹配参数
 * @param query 查询参数
 * @param route 可选：匹配到的路由条目，用于填充 `matchedRoute` 快照
 * @returns 供 `export async function foo(ctx)` 使用的上下文
 */
export function buildApiRouteContext(
  ctx: HttpContext,
  params: Record<string, string>,
  query: Record<string, string>,
  route?: {
    path: string;
    file: string;
    fullPath: string;
    isApi: boolean;
  } | null,
): ApiRouteContext {
  const session = (ctx as { session?: unknown }).session;
  const href = ctx.url.href;
  const pathname = pathnameFromHref(href);
  const cookieRecord = parseCookie(ctx.request.headers.get("Cookie"));
  const base: ApiRouteContext = {
    request: ctx.request,
    req: ctx.request,
    path: pathname,
    method: ctx.method,
    headers: ctx.request.headers,
    params,
    query,
    /** 保留上游中间件已解析的 body（若有）；否则由 RouterAdapter 再解析 */
    body: ctx.body,
    error: undefined,
    url: href,
    cookies: cookieRecord,
    pathname,
    search: searchFromHref(href),
    requestId: resolveRequestId(ctx.request.headers),
    clientIp: resolveClientIp(ctx.request.headers),
    matchedRoute: route ? snapshotMatchedRoute(route) : undefined,
    res: createServerResponse(),
  };
  if (session !== undefined) {
    base.session = session;
  }
  return base;
}
