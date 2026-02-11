/**
 * @module @dreamer/server
 *
 * @dreamer/server 统一的 HTTP 服务器库
 *
 * 提供完整的 HTTP 服务器功能，包括：
 * - HTTP 服务器核心（中间件、路由、错误处理等）
 * - 开发服务器（HMR 热更新、文件监听）
 * - 生产服务器（优化配置）
 *
 * 环境兼容性：
 * - 服务端：✅ 支持（Deno 和 Bun 运行时）
 *
 * @example
 * ```typescript
 * import { Server } from "@dreamer/server";
 *
 * // 开发服务器
 * const devServer = new Server({
 *   mode: "dev",
 *   port: 3000,
 *   dev: {
 *     hmr: true,
 *     watch: ["./src"],
 *   },
 * });
 *
 * await devServer.start();
 *
 * // 生产服务器
 * const prodServer = new Server({
 *   mode: "prod",
 *   port: 8000,
 * });
 *
 * await prodServer.start();
 * ```
 */

// 导出核心类
export { Server } from "./server.ts";
export type {
  DevConfig,
  HMRConfig,
  ServerMode,
  ServerOptions,
  WatchConfig,
} from "./types.ts";

// 导出 HTTP 应用类（内部使用，也可以直接使用）
export { Http } from "./http/http.ts";
export type { HttpServerOptions, PathHandler } from "./http/http.ts";

// 导出 HTTP 服务器函数
export { serve } from "./http/server.ts";
export type { ServerOptions as ServeOptions } from "./http/server.ts";

// 导出上下文类型
export type { CookieOptions, HttpContext, HttpError } from "./context.ts";

// 导出 Cookie 工具
export { CookieManager, parseCookie, serializeCookie } from "./cookie.ts";

// 导出路由适配器
export {
  RouterAdapter,
  type RouterAdapterOptions,
  type SSRRenderCallback,
} from "./router-adapter.ts";

// 重新导出中间件类型（方便使用）
export type {
  Middleware,
  MiddlewareChain,
  MiddlewareContext,
} from "@dreamer/middleware";

// 重新导出路由类型（方便使用）
export type { RouteMatch, Router } from "@dreamer/router";

// 导出 HMR 客户端工具（用于自定义 HMR 客户端）
export { generateHMRClientScript, injectHMRClient } from "./dev/hmr-client.ts";
