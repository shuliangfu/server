/**
 * 路由适配器
 *
 * 集成 @dreamer/router 进行路由匹配和处理。
 *
 * `apiMode: "action"`（与 `@dreamer/router` `loadApiHandlers` 一致）：模块导出 `login`、`save` 等
 * 进入 `RouteMatch.handlers`，HTTP 动词 **不作为**键；此处按动态参数 `params.action` 或 **路径末段**
 * （含 kebab-case → camelCase）解析具体函数。
 */

import type { RouteMatch, Router } from "@dreamer/router";
import { buildApiRouteContext } from "./context.ts";
import type { ApiRouteContext } from "./context.ts";
import type { HttpContext } from "./context.ts";

/** Router 实例上可选的 `getApiMode`（JSR 类型未必声明） */
type RouterWithApiMode = Router & {
  getApiMode?: () => "restful" | "action";
};

/**
 * SSR 渲染回调函数类型
 * 用于处理页面路由的服务端渲染
 */
export type SSRRenderCallback = (
  ctx: HttpContext,
  match: RouteMatch,
) => Promise<Response | null>;

/**
 * API 上下文扩展函数。
 *
 * 说明：
 * - server 包只提供扩展点，不直接依赖上层框架。
 * - dweb 可通过该函数向 ApiContext 注入 app、container 等框架级对象。
 */
export type ApiContextExtender = (
  ctx: HttpContext,
  match: RouteMatch,
) => Record<string, unknown> | void | Promise<Record<string, unknown> | void>;

/**
 * 路由适配器配置选项
 */
export interface RouterAdapterOptions {
  /** SSR 渲染回调函数（用于处理页面路由的服务端渲染） */
  ssrRender?: SSRRenderCallback;
  /** API 上下文扩展函数，用于给文件路由 API 注入上层框架字段 */
  extendApiContext?: ApiContextExtender;
}

/**
 * 路由适配器类
 * 用于在 HTTP 服务器中集成路由系统
 */
export class RouterAdapter {
  private router: Router;
  private ssrRender?: SSRRenderCallback;
  private extendApiContext?: ApiContextExtender;

  /**
   * 创建路由适配器
   *
   * @param router 路由实例
   * @param options 路由适配器选项
   */
  constructor(router: Router, options?: RouterAdapterOptions) {
    this.router = router;
    this.ssrRender = options?.ssrRender;
    this.extendApiContext = options?.extendApiContext;
  }

  /**
   * 设置 SSR 渲染回调
   *
   * @param callback SSR 渲染回调
   */
  setSSRRender(callback: SSRRenderCallback): void {
    this.ssrRender = callback;
  }

  /**
   * 处理路由匹配
   *
   * @param ctx HTTP 上下文
   * @returns 是否处理了路由
   */
  async handle(ctx: HttpContext): Promise<boolean> {
    try {
      const match = await this.router.match(ctx.path, {
        method: ctx.method,
      });

      if (!match) {
        return false;
      }

      // 设置路由参数
      if (match.params) {
        ctx.params = match.params;
      }

      // 处理 API 路由
      if (match.isApi && match.handlers) {
        const handler = this.resolveApiHandler(ctx, match);
        if (handler) {
          const apiCtx = buildApiRouteContext(
            ctx,
            match.params || {},
            ctx.query || {},
            match.route,
          );
          await RouterAdapter.attachParsedJsonBodyIfNeeded(apiCtx);
          const extra = await this.extendApiContext?.(ctx, match);
          if (extra) {
            Object.assign(
              apiCtx as ApiRouteContext & Record<string, unknown>,
              extra,
            );
          }
          const response = await handler(apiCtx);
          ctx.response = response instanceof Response
            ? response
            : Response.json(response);
          return true;
        }
      }

      // 页面路由：如果设置了 SSR 渲染回调，调用它进行渲染
      if (this.ssrRender) {
        const response = await this.ssrRender(ctx, match);
        if (response) {
          ctx.response = response;
          return true;
        }
      }

      // 将路由匹配信息存储在上下文中，供后续中间件使用
      (ctx as any).routeMatch = match;

      // 页面路由未设置 SSR 回调，标记已匹配但让后续中间件处理
      return false;
    } catch {
      // 路由处理错误，返回 false 让其他中间件处理
      return false;
    }
  }

  /**
   * 获取路由实例
   *
   * @returns 路由实例
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * 对 JSON 请求预解析正文并写入 `apiCtx.body`（GET/HEAD 跳过；无 body 或解析失败则保持 `undefined`）。
   * 解析后 `req` 的 body 流已消费，勿再调用 `req.json()`。
   *
   * @param apiCtx 已由 {@link buildApiRouteContext} 构造的上下文
   */
  private static async attachParsedJsonBodyIfNeeded(
    apiCtx: ApiRouteContext,
  ): Promise<void> {
    const method = (apiCtx.method ?? "GET").toUpperCase();
    if (method === "GET" || method === "HEAD") return;

    const ct = apiCtx.req.headers.get("content-type") ?? "";
    if (!ct.toLowerCase().includes("json")) return;
    if (!apiCtx.req.body) return;

    try {
      apiCtx.body = await apiCtx.req.json();
    } catch {
      apiCtx.body = undefined;
    }
  }

  /**
   * 解析 API 处理器：`restful` / 混用动词导出时优先 `handlers[GET|POST|…]`；
   * `action` 模式下再按 `params.action`、路径末段、kebab→camel 匹配。
   */
  private resolveApiHandler(
    ctx: HttpContext,
    match: RouteMatch,
  ):
    | ((context: ApiRouteContext) => Promise<Response> | Response)
    | undefined {
    /** Router 侧 handlers 类型仍为 (request, ctx)，运行时仅传入 ApiRouteContext */
    const handlers = match.handlers as unknown as Record<
      string,
      ((context: ApiRouteContext) => Promise<Response> | Response) | undefined
    >;
    if (!handlers) return undefined;

    const methodKey = (ctx.method ?? "GET").toUpperCase();
    const byVerb = handlers[methodKey];
    if (typeof byVerb === "function") return byVerb;

    const apiMode = (this.router as RouterWithApiMode).getApiMode?.();
    if (apiMode !== "action") return undefined;

    const params = match.params ?? {};
    const actionParam = params.action ?? params.method;
    if (
      actionParam &&
      typeof handlers[actionParam] === "function"
    ) {
      return handlers[actionParam];
    }

    const seg = ctx.path.split("/").filter(Boolean).pop();
    if (!seg) return undefined;
    if (typeof handlers[seg] === "function") return handlers[seg];
    if (seg.includes("-")) {
      const camel = seg.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      if (typeof handlers[camel] === "function") return handlers[camel];
    }
    return undefined;
  }
}
