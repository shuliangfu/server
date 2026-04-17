/**
 * API 文件路由唯一参数上下文（由 {@link buildApiRouteContext} 注入）。
 * 字段使用 **`req` / `res` 简写**（与页面 `load(ctx)` 的 `request` / `response` 区分，避免冗长）。
 */

import { parseCookie } from "./cookie.ts";
import type { HttpContext } from "./context.ts";

/**
 * 服务端响应辅助：与 dweb `createServerResponse` 行为一致，供 `ctx.res.json` 等使用
 */
export interface ServerResponse {
  redirect(url: string, status?: number): Response;
  json(data: unknown, init?: ResponseInit): Response;
  html(body: string, init?: ResponseInit): Response;
  text(body: string, init?: ResponseInit): Response;
  binary(data: Uint8Array | ArrayBuffer, init?: ResponseInit): Response;
  body(
    body: string | ReadableStream<Uint8Array> | Blob | ArrayBuffer | null,
    init?: ResponseInit,
  ): Response;
  status(code: number, statusText?: string): Response;
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
  return {
    redirect(url: string, status = 302): Response {
      return new Response(null, {
        status,
        headers: new Headers({ Location: url }),
      });
    },
    json(data: unknown, init?: ResponseInit): Response {
      const body = JSON.stringify(data);
      const headers = new Headers(init?.headers ?? JSON_HEADERS);
      return new Response(body, { ...init, headers });
    },
    html(body: string, init?: ResponseInit): Response {
      const headers = new Headers(init?.headers ?? HTML_HEADERS);
      return new Response(body, { ...init, headers });
    },
    text(body: string, init?: ResponseInit): Response {
      const headers = new Headers(init?.headers ?? TEXT_HEADERS);
      return new Response(body, { ...init, headers });
    },
    binary(data: Uint8Array | ArrayBuffer, init?: ResponseInit): Response {
      const headers = new Headers(init?.headers ?? BINARY_HEADERS);
      return new Response(data as BodyInit, { ...init, headers });
    },
    body(
      body: string | ReadableStream<Uint8Array> | Blob | ArrayBuffer | null,
      init?: ResponseInit,
    ): Response {
      return new Response(body, init);
    },
    status(code: number, statusText?: string): Response {
      return new Response(null, { status: code, statusText });
    },
  };
}

/**
 * 文件路由 API 处理器参数：含 `req`（Request）、`res`（响应助手）等。
 */
export interface ApiRouteContext {
  /** 当前请求完整 URL（含 search） */
  url: string;
  /** 路由动态参数 */
  params: Record<string, string>;
  /** 查询串解析结果 */
  query: Record<string, string>;
  /** 原始 Web Request */
  req: Request;
  /** redirect / json / html 等与页面 load 中 `response` 同级能力 */
  res: ServerResponse;
  /** HTTP 方法（与 HttpContext.method 一致） */
  method: string;
  /** 从 Cookie 头解析的键值 */
  cookies: Record<string, string>;
  /** 请求头（与 `req.headers` 相同引用） */
  headers: Headers;
  /** 由 session 等中间件挂在 HttpContext 上时存在 */
  session?: unknown;
  [key: string]: unknown;
}

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
 * @returns 供 `export async function foo(ctx)` 使用的上下文
 */
export function buildApiRouteContext(
  ctx: HttpContext,
  params: Record<string, string>,
  query: Record<string, string>,
): ApiRouteContext {
  const session = (ctx as { session?: unknown }).session;
  const base: ApiRouteContext = {
    url: ctx.url.href,
    params,
    query,
    req: ctx.request,
    res: createServerResponse(),
    method: ctx.method,
    cookies: parseCookie(ctx.request.headers.get("Cookie")),
    headers: ctx.request.headers,
  };
  if (session !== undefined) {
    base.session = session;
  }
  return base;
}
