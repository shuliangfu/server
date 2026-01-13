/**
 * 路由适配器
 *
 * 集成 @dreamer/router 进行路由匹配和处理
 */

import type { Router, RouteMatch } from "@dreamer/router";
import type { HttpContext } from "./context.ts";

/**
 * 路由适配器类
 * 用于在 HTTP 服务器中集成路由系统
 */
export class RouterAdapter {
  private router: Router;

  /**
   * 创建路由适配器
   *
   * @param router 路由实例
   */
  constructor(router: Router) {
    this.router = router;
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

      // 页面路由（SSR）由路由系统处理，这里只标记已匹配
      // 实际的 SSR 渲染需要配合 SSR 框架使用
      return true;
    } catch (error) {
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
