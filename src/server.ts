/**
 * @dreamer/server 统一的服务器类
 *
 * 提供开发和生产环境的统一服务器接口
 */

import type { Logger } from "@dreamer/logger";
import { createLogger } from "@dreamer/logger";
import type { ServeHandle } from "@dreamer/runtime-adapter";

import { DevTools } from "./dev/dev-tools.ts";
import type { HttpServerOptions, PathHandler } from "./http/http.ts";
import { Http } from "./http/http.ts";
import type { ServerMode, ServerOptions } from "./types.ts";

/**
 * 统一的服务器类
 *
 * 支持开发和生产模式，自动配置相应的功能
 */
export class Server {
  private httpApp: Http;
  private devTools?: DevTools;
  private serverHandle?: ServeHandle;
  private readonly mode: ServerMode;
  private readonly _port: number;
  private readonly _host: string;
  private readonly logger: Logger;
  private readonly shutdownTimeout: number;

  /**
   * 创建服务器实例
   *
   * @param options 服务器配置选项
   */
  constructor(options: ServerOptions = {}) {
    this.mode = options.mode || "prod";
    this._port = options.port || (this.mode === "dev" ? 3000 : 8000);
    this._host = options.host || "localhost";
    this.logger = options.logger || createLogger();
    this.shutdownTimeout = options.shutdownTimeout || 10000;

    // 创建 HTTP 应用（核心功能）
    const httpOptions: HttpServerOptions = {
      port: this._port,
      host: this._host,
      onListen: options.onListen,
      onError: options.onError,
      logger: this.logger,
      debug: options.debug,
    };

    this.httpApp = new Http(httpOptions);

    // 开发模式：添加开发工具
    if (this.mode === "dev" && options.dev) {
      this.devTools = new DevTools({
        httpApp: this.httpApp,
        ...options.dev,
        port: this._port,
        host: this._host,
      });
    }
  }

  /**
   * 启动服务器
   */
  start(): void {
    // 启动 HTTP 服务器
    this.serverHandle = this.httpApp.listen({
      port: this._port,
      host: this._host,
      onListen: ({ host, port }) => {
        this.logger.info(
          `${
            this.mode === "dev" ? "开发" : "生产"
          }服务器运行在 http://${host}:${port}`,
        );
      },
    });

    // 开发模式：启动开发工具
    if (this.devTools) {
      this.devTools.start();
    }
  }

  /**
   * 停止服务器（优雅关闭）
   *
   * @param timeout 等待请求完成的超时时间（毫秒，默认使用配置的超时时间）
   */
  async stop(timeout?: number): Promise<void> {
    this.logger.info("正在停止服务器...");

    // 先进行优雅关闭（等待请求完成）
    await this.httpApp.gracefulShutdown(timeout ?? this.shutdownTimeout);

    // 停止开发工具
    if (this.devTools) {
      await this.devTools.stop();
    }

    // 停止 HTTP 服务器
    if (this.serverHandle) {
      await this.serverHandle.shutdown();
    }

    this.logger.info("服务器已停止");
  }

  /**
   * 获取 HTTP 应用实例（用于添加中间件、路由等）
   */
  get http(): Http {
    return this.httpApp;
  }

  /**
   * 注册中间件（便捷方法，代理到 httpApp）
   *
   * @param middleware 中间件函数
   * @param condition 匹配条件（可选）
   * @param name 中间件名称（可选）
   */
  use(
    middleware: Parameters<Http["use"]>[0],
    condition?: Parameters<Http["use"]>[1],
    name?: Parameters<Http["use"]>[2],
  ): void {
    this.httpApp.use(middleware, condition, name);
  }

  /**
   * 集成路由系统（便捷方法，代理到 httpApp）
   *
   * @param router 路由实例
   * @param options 路由适配器选项（可选）
   */
  useRouter(
    router: Parameters<Http["useRouter"]>[0],
    options?: Parameters<Http["useRouter"]>[1],
  ): void {
    this.httpApp.useRouter(router, options);
  }

  /**
   * 设置 SSR 渲染回调（便捷方法，代理到 httpApp）
   *
   * @param callback SSR 渲染回调函数
   */
  setSSRRender(callback: Parameters<Http["setSSRRender"]>[0]): void {
    this.httpApp.setSSRRender(callback);
  }

  /**
   * 设置路径前置处理器（在中间件链之前执行，用于 Socket.IO 等挂载，保证请求被正确接管）
   *
   * @param getter 返回路径处理器数组的函数
   */
  setPathHandlers(getter: () => PathHandler[]): void {
    this.httpApp.setPathHandlers(getter);
  }

  /**
   * 注册错误处理中间件（便捷方法，代理到 httpApp）
   *
   * @param middleware 错误处理中间件函数
   * @param name 中间件名称（可选）
   */
  useError(
    middleware: Parameters<Http["useError"]>[0],
    name?: Parameters<Http["useError"]>[1],
  ): void {
    this.httpApp.useError(middleware, name);
  }

  /**
   * 获取端口号（只读属性）
   */
  get port(): number {
    return this._port;
  }

  /**
   * 获取主机名（只读属性）
   */
  get host(): string {
    return this._host;
  }
}
