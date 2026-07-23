/**
 * HTTP 服务器实现
 *
 * 基于 @dreamer/runtime-adapter 的 serve 函数
 */

import type { ServeHandle, ServeOptions } from "@dreamer/runtime-adapter";
import { serve as runtimeServe } from "@dreamer/runtime-adapter";

/**
 * HTTP 服务器配置选项
 */
export interface ServerOptions extends ServeOptions {
  /** 错误处理函数（可选） */
  onError?: (error: Error) => Response | Promise<Response>;
}

/**
 * 启动 HTTP 服务器
 *
 * @param options 服务器选项
 * @param handler 请求处理器
 * @returns 服务器句柄（Node 上为 Promise，Deno/Bun 上同步；await 三端兼容）
 *
 * @example
 * ```typescript
 * const server = serve({
 *   port: 8000,
 *   handler: async (request) => {
 *     return new Response("Hello, World!");
 *   },
 * });
 *
 * await server.listen();
 * ```
 */
export function serve(
  options: ServerOptions | ((req: Request) => Response | Promise<Response>),
  handler?: (req: Request) => Response | Promise<Response>,
): ServeHandle | Promise<ServeHandle> {
  // 如果第一个参数是函数，则作为 handler
  if (typeof options === "function") {
    return runtimeServe(options);
  }

  // 否则使用 options 和 handler
  const serverOptions: ServeOptions = {
    port: options.port,
    host: options.host,
    onListen: options.onListen,
  };

  // 【Why 根源】runtime-adapter serve() 在 Node 返回 Promise<ServeHandle>（异步
  // 端口绑定），在 Deno/Bun 同步返回 ServeHandle。调用方需 await 以三端兼容。
  return runtimeServe(serverOptions, handler!);
}
