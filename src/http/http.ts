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

import { $i18n } from "@dreamer/i18n";
import type { HttpContext, HttpError } from "../context.ts";
import { CookieManager } from "../cookie.ts";
import { $t, type Locale } from "../i18n.ts";
import {
  RouterAdapter,
  type RouterAdapterOptions,
  type SSRRenderCallback,
} from "../router-adapter.ts";

/** 路径前置处理器：在中间件链之前按路径前缀直接处理请求（用于 Socket.IO 等）；返回 null/undefined 表示不处理、继续后续 pathHandler 或中间件 */
export type PathHandler = {
  pathPrefix: string;
  handler: (
    request: Request,
  ) => Response | Promise<Response> | null | undefined;
};

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
  /** 是否启用调试日志（默认：false），开启后通过 logger.debug 输出请求路径、路径前置处理器、中间件链、响应状态等详细调试信息 */
  debug?: boolean;
  /** 路径前置处理器列表的 getter（在 processRequest 中、中间件链之前执行，用于保证 /socket.io/ 等被正确接管） */
  pathHandlers?: () => PathHandler[];
  /** 服务端文案语言（如 "en-US"、"zh-CN"）；不传则从环境 LANGUAGE/LC_ALL/LANG 检测 */
  lang?: Locale;
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
  /** 路径前置处理器 getter（在中间件链之前执行） */
  private pathHandlersGetter?: () => PathHandler[];
  /** 进行中的请求（用于优雅关闭） */
  private activeRequests: Set<Promise<Response>>;
  /** 是否正在关闭 */
  private isShuttingDown: boolean;
  /** 是否启用调试日志（仅通过 logger.debug 输出，与 socket-io 一致） */
  private readonly debug: boolean;

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
    this.pathHandlersGetter = options.pathHandlers;
    this.activeRequests = new Set();
    this.isShuttingDown = false;
    this.debug = options.debug === true;

    // 若传入 lang，设置全局 locale，后续 $t() 不传 lang 时会使用该语言
    if (options.lang) {
      $i18n.setLocale(options.lang);
    }
  }

  /**
   * 调试日志：仅当 debug=true 时输出，使用 logger.debug（与 socket-io 一致）
   */
  private debugLog(message: string): void {
    if (this.debug) {
      this.logger.debug(`${$t("http.debugPrefix")} ${message}`);
    }
  }

  /**
   * 设置路径前置处理器（在中间件链之前、按路径前缀直接处理请求）
   * 用于框架层挂载 Socket.IO 等，保证请求不被路由或其它中间件接管
   */
  setPathHandlers(getter: () => PathHandler[]): void {
    this.pathHandlersGetter = getter;
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
   * 将路由作为链尾中间件注册，保证顺序为：前置中间件（Socket.IO、静态等）→ 插件中间件（onRequest/onResponse）→ 路由。
   * 这样只执行一次中间件链：路由在 next() 前设置 ctx.response，插件在 next() 返回后通过 onResponse 做后处理（如注入 CSS）。
   *
   * @param router 路由实例
   * @param options 路由适配器选项（可选）
   */
  useRouter(router: Router, options?: RouterAdapterOptions): void {
    this.routerAdapter = new RouterAdapter(router, options);
    this.middlewareChain.use(
      async (ctx, next) => {
        await this.handleRouter(ctx);
        await next();
      },
      undefined,
      "router",
    );
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
      this.logger.error($t("http.routerError"), error);
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
      let checkTimerId: ReturnType<typeof setTimeout> | null = null;

      const check = () => {
        if (this.activeRequests.size === 0) {
          if (checkTimerId !== null) clearTimeout(checkTimerId);
          resolve(true);
          return;
        }

        if (Date.now() - startTime >= timeout) {
          if (checkTimerId !== null) clearTimeout(checkTimerId);
          this.logger.warn(
            $t("http.gracefulShutdownTimeoutPending", {
              count: String(this.activeRequests.size),
            }),
          );
          resolve(false);
          return;
        }

        checkTimerId = setTimeout(check, checkInterval);
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
      this.debugLog($t("http.serverShuttingDownReject"));
      return new Response($t("http.serverShuttingDownBody"), { status: 503 });
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
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    this.debugLog(
      $t("http.requestReceived", {
        method,
        pathname,
        search: url.search ? `?${url.search}` : "",
      }),
    );

    // 检查 WebSocket 升级请求
    if (request.headers.get("upgrade") === "websocket") {
      this.debugLog($t("http.wsUpgradeRequest", { pathname }));
      const handler = this.wsHandlers.get(pathname);
      if (handler) {
        this.debugLog($t("http.wsHandlerMatched", { pathname }));
        return handler(request);
      }
      this.debugLog($t("http.wsNoHandler", { pathname }));
    }

    // 路径前置处理器：在中间件链之前执行，保证 /socket.io/ 等由框架挂载的处理器直接接管，避免被路由或其它中间件影响
    const pathHandlers = this.pathHandlersGetter?.() ?? [];
    this.debugLog(
      $t("http.checkPathHandlers", { count: String(pathHandlers.length) }),
    );
    for (const ph of pathHandlers) {
      const prefixNoTrailing = ph.pathPrefix.replace(/\/$/, "");
      const matches = pathname.startsWith(ph.pathPrefix) ||
        pathname === prefixNoTrailing;
      this.debugLog(
        $t(matches ? "http.pathHandlerMatch" : "http.pathHandlerNoMatch", {
          prefix: ph.pathPrefix,
          pathname,
        }),
      );
      if (matches) {
        const res = await Promise.resolve(ph.handler(request));
        if (res != null) {
          this.debugLog(
            $t("http.pathHandlerTookOver", {
              prefix: ph.pathPrefix,
              status: String(res.status),
            }),
          );
          return res;
        }
        this.debugLog($t("http.pathHandlerReturnedNull"));
      }
    }

    const ctx = this.createContext(request);

    try {
      this.debugLog($t("http.enteringMiddlewareChain", { pathname }));
      // 中间件链只执行一次：路径前缀（Socket.IO、静态）→ 插件（onRequest/next/onResponse）→ 路由；路由在链尾设置 ctx.response，插件的 onResponse 在 next() 返回后注入 CSS 等
      try {
        await this.middlewareChain.execute(ctx);
      } catch (error) {
        throw error;
      }

      // 获取响应
      let response = ctx.response ||
        new Response($t("http.notFound"), { status: 404 });
      this.debugLog(
        $t(
          ctx.response
            ? "http.middlewareChainDone"
            : "http.middlewareChainDoneNoRoute",
          { status: String(response.status) },
        ),
      );

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
      const errMsg = error instanceof Error ? error.message : String(error);
      this.debugLog($t("http.requestException", { message: errMsg }));
      // 错误对象作为第三个参数传入，logger 会输出 message/stack，避免 JSON.stringify(Error) 得到 {}
      this.logger.error($t("http.requestError"), undefined, error);

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
    this.logger.info($t("http.gracefulShutdownStart"));
    this.isShuttingDown = true;

    // 等待所有进行中的请求完成
    const allCompleted = await this.waitForRequests(timeout);

    if (allCompleted) {
      this.logger.info($t("http.allRequestsCompleted"));
    } else {
      this.logger.warn($t("http.gracefulShutdownTimeoutForce"));
    }

    // 清理资源
    this.activeRequests.clear();
    this.wsHandlers.clear();
  }
}
