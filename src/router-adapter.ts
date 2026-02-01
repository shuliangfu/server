/**
 * 路由适配器
 *
 * 集成 @dreamer/router 进行路由匹配和处理
 */

import type { RouteMatch, Router } from "@dreamer/router";
import type { HttpContext } from "./context.ts";

/**
 * SSR 渲染回调函数类型
 * 用于处理页面路由的服务端渲染
 */
export type SSRRenderCallback = (
  ctx: HttpContext,
  match: RouteMatch,
) => Promise<Response | null>;

/**
 * 路由适配器配置选项
 */
export interface RouterAdapterOptions {
  /** SSR 渲染回调函数（用于处理页面路由的服务端渲染） */
  ssrRender?: SSRRenderCallback;
}

/**
 * 路由适配器类
 * 用于在 HTTP 服务器中集成路由系统
 */
export class RouterAdapter {
  private router: Router;
  private ssrRender?: SSRRenderCallback;

  /**
   * 创建路由适配器
   *
   * @param router 路由实例
   * @param options 适配器选项
   */
  constructor(router: Router, options?: RouterAdapterOptions) {
    this.router = router;
    this.ssrRender = options?.ssrRender;
  }

  /**
   * 设置 SSR 渲染回调
   *
   * @param callback SSR 渲染回调函数
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
        const handler =
          match.handlers[ctx.method as keyof typeof match.handlers];
        if (handler) {
          const response = await handler(ctx.request, {
            params: match.params || {},
            query: ctx.query || {},
          });
          ctx.response = response instanceof Response
            ? response
            : new Response(JSON.stringify(response), {
              headers: { "Content-Type": "application/json" },
            });
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
}
