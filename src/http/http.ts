/**
 * HTTP 服务器类
 *
 * 提供完整的 HTTP 应用功能（中间件、路由、错误处理等）
 */

import type { Logger } from "@dreamer/logger";
import { createLogger } from "@dreamer/logger";
import {
  type ErrorMiddleware,
  type Middleware,
  type MiddlewareChain,
  MiddlewareChain as MiddlewareChainImpl,
} from "@dreamer/middleware";
import type { Router } from "@dreamer/router";
import type { ServeHandle, ServeOptions } from "@dreamer/runtime-adapter";
import { serve as runtimeServe } from "@dreamer/runtime-adapter";

import type { HttpContext, HttpError } from "../context.ts";
import { CookieManager } from "../cookie.ts";
import {
  RouterAdapter,
  type RouterAdapterOptions,
  type SSRRenderCallback,
} from "../router-adapter.ts";

/**
 * HTTP 服务器配置选项
 */
export interface HttpServerOptions {
  /** 端口号 */
  port?: number;
  /** 主机名 */
  host?: string;
  /** 监听回调 */
  onListen?: (params: { host: string; port: number }) => void;
  /** 错误处理函数（可选） */
  onError?: (error: Error) => Response | Promise<Response>;
  /** Logger 实例（可选，如果提供则使用，否则创建默认 logger） */
  logger?: Logger;
}

/**
 * HTTP 应用类
 *
 * 提供完整的 HTTP 服务器功能，包括：
 * - 中间件系统集成
 * - 路由系统集成
 * - Cookie 管理
 * - 错误处理
 * - 日志记录
 */
export class Http {
  /** 中间件链 */
  private middlewareChain: MiddlewareChain<HttpContext>;
  /** 路由适配器（可选） */
  private routerAdapter?: RouterAdapter;
  /** Logger 实例 */
  private logger: Logger;
  /** 错误处理函数 */
  private onError?: (error: Error) => Response | Promise<Response>;
  /** WebSocket 升级处理器（路径 -> 处理器） */
  private wsHandlers: Map<string, (req: Request) => Response>;
  /** 进行中的请求（用于优雅关闭） */
  private activeRequests: Set<Promise<Response>>;
  /** 是否正在关闭 */
  private isShuttingDown: boolean;

  /**
   * 创建 HTTP 应用实例
   *
   * @param options 配置选项
   */
  constructor(options: HttpServerOptions = {}) {
    this.middlewareChain = new MiddlewareChainImpl<HttpContext>();
    this.logger = options.logger || createLogger();
    this.onError = options.onError;
    this.wsHandlers = new Map();
    this.activeRequests = new Set();
    this.isShuttingDown = false;
  }

  /**
   * 注册中间件
   *
   * @param middleware 中间件函数
   * @param condition 匹配条件（可选）
   * @param name 中间件名称（可选）
   */
  use(
    middleware: Middleware<HttpContext>,
    condition?: string | Parameters<MiddlewareChain<HttpContext>["use"]>[1],
    name?: string,
  ): void {
    this.middlewareChain.use(middleware, condition as any, name);
  }

  /**
   * 集成路由系统
   *
   * @param router 路由实例
   * @param options 路由适配器选项（可选）
   */
  useRouter(router: Router, options?: RouterAdapterOptions): void {
    this.routerAdapter = new RouterAdapter(router, options);
  }

  /**
   * 设置 SSR 渲染回调
   * 用于处理页面路由的服务端渲染
   *
   * @param callback SSR 渲染回调函数
   */
  setSSRRender(callback: SSRRenderCallback): void {
    if (this.routerAdapter) {
      this.routerAdapter.setSSRRender(callback);
    }
  }

  /**
   * 注册错误处理中间件
   *
   * @param middleware 错误处理中间件函数
   * @param name 中间件名称（可选）
   */
  useError(
    middleware: ErrorMiddleware<HttpContext>,
    name?: string,
  ): void {
    this.middlewareChain.useError(middleware, name);
  }

  /**
   * 创建 HTTP 上下文
   *
   * @param request 请求对象
   * @returns HTTP 上下文
   */
  private createContext(request: Request): HttpContext {
    const url = new URL(request.url);
    const cookieHeader = request.headers.get("Cookie");
    const cookieManager = new CookieManager(cookieHeader);

    // 解析查询参数
    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    const ctx: HttpContext = {
      request,
      path: url.pathname,
      method: request.method,
      url,
      headers: request.headers,
      query,
      cookies: {
        get: (name: string) => cookieManager.get(name),
        set: (name: string, value: string, options?) => {
          cookieManager.set(name, value, options);
        },
        remove: (name: string) => cookieManager.remove(name),
        getAll: () => cookieManager.getAll(),
      },
    };

    // 将 Cookie 管理器保存到上下文中，以便后续应用
    (ctx.cookies as any).__manager = cookieManager;

    return ctx;
  }

  /**
   * 处理路由匹配
   *
   * @param ctx HTTP 上下文
   * @returns 是否处理了路由
   */
  private async handleRouter(ctx: HttpContext): Promise<boolean> {
    if (!this.routerAdapter) {
      return false;
    }

    try {
      return await this.routerAdapter.handle(ctx);
    } catch (error) {
      this.logger.error("路由处理错误:", error);
      return false;
    }
  }

  /**
   * 注册 WebSocket 升级处理器
   *
   * @param path WebSocket 路径
   * @param handler 升级处理器函数
   */
  onWebSocket(path: string, handler: (req: Request) => Response): void {
    this.wsHandlers.set(path, handler);
  }

  /**
   * 等待所有进行中的请求完成
   *
   * @param timeout 超时时间（毫秒，默认：10000）
   * @returns 是否所有请求都已完成
   */
  waitForRequests(timeout: number = 10000): Promise<boolean> {
    if (this.activeRequests.size === 0) {
      return Promise.resolve(true);
    }

    const startTime = Date.now();
    const checkInterval = 100; // 每 100ms 检查一次

    return new Promise((resolve) => {
      const check = () => {
        if (this.activeRequests.size === 0) {
          resolve(true);
          return;
        }

        if (Date.now() - startTime >= timeout) {
          this.logger.warn(
            `优雅关闭超时，仍有 ${this.activeRequests.size} 个请求未完成`,
          );
          resolve(false);
          return;
        }

        setTimeout(check, checkInterval);
      };

      check();
    });
  }

  /**
   * 处理请求
   *
   * @param request 请求对象
   * @returns 响应对象
   */
  private async handleRequest(request: Request): Promise<Response> {
    // 如果正在关闭，拒绝新请求
    if (this.isShuttingDown) {
      return new Response("Server is shutting down", { status: 503 });
    }

    // 创建请求 Promise 并跟踪
    const requestPromise = this.processRequest(request);
    this.activeRequests.add(requestPromise);

    try {
      const response = await requestPromise;
      return response;
    } finally {
      // 请求完成，移除跟踪
      this.activeRequests.delete(requestPromise);
    }
  }

  /**
   * 处理请求（实际处理逻辑）
   *
   * @param request 请求对象
   * @returns 响应对象
   */
  private async processRequest(request: Request): Promise<Response> {
    // 检查 WebSocket 升级请求
    if (request.headers.get("upgrade") === "websocket") {
      const url = new URL(request.url);
      const handler = this.wsHandlers.get(url.pathname);
      if (handler) {
        return handler(request);
      }
    }

    const ctx = this.createContext(request);

    try {
      // 先尝试路由匹配
      const routerHandled = await this.handleRouter(ctx);

      // 如果路由未处理，执行中间件链
      if (!routerHandled) {
        try {
          await this.middlewareChain.execute(ctx);
        } catch (error) {
          // 中间件链的错误会被 MiddlewareChain 内部的错误处理中间件捕获
          // 如果还有未处理的错误，继续抛出
          throw error;
        }
      }

      // 获取响应
      let response = ctx.response || new Response("Not Found", { status: 404 });

      // 应用 Cookie 到响应头
      const cookieManager = (ctx.cookies as any).__manager as CookieManager;
      if (cookieManager) {
        response = cookieManager.applyToResponse(response);
      } else {
        // 如果 Cookie 管理器不存在，重新创建并应用
        const cookieHeader = request.headers.get("Cookie");
        const manager = new CookieManager(cookieHeader);
        // 复制已设置的 Cookie
        const allCookies = ctx.cookies.getAll();
        for (const [name, value] of Object.entries(allCookies)) {
          manager.set(name, value);
        }
        response = manager.applyToResponse(response);
      }

      return response;
    } catch (error) {
      this.logger.error("请求处理错误:", error);

      // 使用自定义错误处理函数
      if (this.onError) {
        return await this.onError(
          error instanceof Error ? error : new Error(String(error)),
        );
      }

      // 默认错误响应
      const errorResponse: HttpError = {
        status: 500,
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };

      ctx.error = errorResponse;

      return new Response(
        JSON.stringify({ error: errorResponse }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  /**
   * 启动 HTTP 服务器
   *
   * @param options 服务器选项
   * @returns 服务器句柄
   */
  listen(options: HttpServerOptions = {}): ServeHandle {
    const handler = (request: Request) => this.handleRequest(request);

    const serverOptions: ServeOptions = {
      port: options.port,
      host: options.host,
      onListen: options.onListen,
    };

    const handle = runtimeServe(serverOptions, handler);

    return handle;
  }

  /**
   * 优雅关闭
   *
   * @param timeout 等待请求完成的超时时间（毫秒，默认：10000）
   * @returns Promise，在所有请求完成后 resolve
   */
  async gracefulShutdown(timeout: number = 10000): Promise<void> {
    this.logger.info("开始优雅关闭...");
    this.isShuttingDown = true;

    // 等待所有进行中的请求完成
    const allCompleted = await this.waitForRequests(timeout);

    if (allCompleted) {
      this.logger.info("所有请求已完成，服务器已关闭");
    } else {
      this.logger.warn("优雅关闭超时，强制关闭服务器");
    }

    // 清理资源
    this.activeRequests.clear();
    this.wsHandlers.clear();
  }
}
