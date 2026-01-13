/**
 * 响应压缩中间件
 *
 * 自动压缩 HTTP 响应体，支持 gzip 和 brotli 压缩算法
 */

import type { Middleware } from "@dreamer/middleware";
import type { HttpContext } from "../context.ts";

/**
 * 压缩配置选项
 */
export interface CompressionOptions {
  /** 压缩级别（1-9，默认：6，仅适用于 gzip） */
  level?: number;
  /** 最小响应大小（字节），小于此大小不压缩（默认：1024） */
  threshold?: number;
  /** 要压缩的 Content-Type（默认：所有文本类型） */
  filter?: (contentType: string) => boolean;
  /** 是否启用 brotli 压缩（需要运行时支持，默认：false） */
  enableBrotli?: boolean;
}

/**
 * 默认的 Content-Type 过滤器
 * 只压缩文本类型的响应
 */
function defaultFilter(contentType: string): boolean {
  const textTypes = [
    "text/",
    "application/json",
    "application/javascript",
    "application/xml",
    "application/rss+xml",
    "application/atom+xml",
    "image/svg+xml",
  ];

  return textTypes.some((type) => contentType.includes(type));
}

/**
 * 压缩数据（gzip）
 *
 * @param data 要压缩的数据
 * @param level 压缩级别
 * @returns 压缩后的数据
 */
async function compressGzip(
  data: Uint8Array,
  level: number = 6,
): Promise<Uint8Array> {
  // 使用 pako 库进行 gzip 压缩（跨运行时兼容）
  const { gzip } = await import("pako");
  return gzip(data, { level });
}

/**
 * 压缩数据（brotli）
 *
 * @param data 要压缩的数据
 * @returns 压缩后的数据
 */
async function compressBrotli(data: Uint8Array): Promise<Uint8Array> {
  // 尝试使用运行时的 brotli 支持
  // Deno 和 Bun 都支持 CompressionStream API，但可能不支持 "br"
  // 如果 CompressionStream 不支持 "br"，使用 npm 包
  if (typeof CompressionStream !== "undefined") {
    try {
      // 尝试使用 CompressionStream（某些运行时可能支持）
      const stream = new CompressionStream("br" as any);
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      // 写入数据（转换为新的 ArrayBuffer）
      const buffer = new Uint8Array(data).buffer;
      writer.write(buffer);
      writer.close();

      // 读取压缩后的数据
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // 合并所有块
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      return result;
    } catch {
      // CompressionStream 不支持 "br"，使用 npm 包
      // 继续尝试使用 npm 包
    }
  }

  // 使用 npm 包进行 brotli 压缩（跨运行时兼容）
  try {
    // 使用 npm:brotli 包（支持 Deno 和 Bun）
    const brotliModule = await import("brotli");

    const { compress } = brotliModule;
    if (typeof compress !== "function") {
      throw new Error("Brotli compress function not found");
    }

    const result = compress(data);
    // brotli 包返回的是 Buffer 或 Uint8Array
    return result instanceof Uint8Array ? result : new Uint8Array(result);
  } catch (error) {
    // 如果 brotli 包不可用，抛出错误
    throw new Error(
      `Brotli compression not supported in this runtime: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * 创建响应压缩中间件
 *
 * @param options 压缩配置选项
 * @returns 压缩中间件函数
 *
 * @example
 * ```typescript
 * import { compression } from "@dreamer/server";
 *
 * // 使用默认配置
 * app.use(compression());
 *
 * // 自定义配置
 * app.use(compression({
 *   level: 9, // 最高压缩级别
 *   threshold: 2048, // 只压缩大于 2KB 的响应
 *   enableBrotli: true, // 启用 brotli 压缩
 * }));
 * ```
 */
export function compression(
  options: CompressionOptions = {},
): Middleware<HttpContext> {
  const {
    level = 6,
    threshold = 1024, // 1KB
    filter = defaultFilter,
    enableBrotli = false,
  } = options;

  return async (ctx: HttpContext, next: () => Promise<void>): Promise<void> => {
    // 先执行下一个中间件，获取响应
    await next();

    // 如果没有响应，直接返回
    if (!ctx.response) {
      return;
    }

    // 检查是否已经压缩
    const contentEncoding = ctx.response.headers.get("Content-Encoding");
    if (contentEncoding) {
      // 已经压缩，不再压缩
      return;
    }

    // 检查 Content-Type
    const contentType = ctx.response.headers.get("Content-Type") || "";
    if (!filter(contentType)) {
      // 不在压缩范围内
      return;
    }

    // 检查 Accept-Encoding
    const acceptEncoding = ctx.headers.get("Accept-Encoding") || "";
    const supportsGzip = acceptEncoding.includes("gzip");
    const supportsBrotli = enableBrotli && acceptEncoding.includes("br");

    if (!supportsGzip && !supportsBrotli) {
      // 客户端不支持压缩
      return;
    }

    // 读取响应体（需要克隆响应，因为响应体只能读取一次）
    const responseClone = ctx.response.clone();
    const responseBody = await responseClone.arrayBuffer();
    const data = new Uint8Array(responseBody);

    // 检查大小阈值
    if (data.length < threshold) {
      // 太小，不压缩
      return;
    }

    try {
      let compressed: Uint8Array;
      let encoding: string;

      // 优先使用 brotli（如果支持且启用）
      if (supportsBrotli && enableBrotli) {
        try {
          compressed = await compressBrotli(data);
          encoding = "br";
        } catch {
          // Brotli 压缩失败，回退到 gzip
          compressed = await compressGzip(data, level);
          encoding = "gzip";
        }
      } else if (supportsGzip) {
        compressed = await compressGzip(data, level);
        encoding = "gzip";
      } else {
        // 不支持任何压缩
        return;
      }

      // 检查压缩是否有效（压缩后应该更小）
      if (compressed.length >= data.length) {
        // 压缩后没有变小，不压缩
        return;
      }

      // 创建新的响应头
      const headers = new Headers(ctx.response.headers);
      headers.set("Content-Encoding", encoding);
      headers.set("Content-Length", compressed.length.toString());
      // 移除 Vary 头中的 Accept-Encoding（如果存在），然后添加
      const vary = headers.get("Vary");
      if (vary && !vary.includes("Accept-Encoding")) {
        headers.set("Vary", `${vary}, Accept-Encoding`);
      } else if (!vary) {
        headers.set("Vary", "Accept-Encoding");
      }

      // 创建压缩后的响应
      ctx.response = new Response(compressed as BodyInit, {
        status: ctx.response.status,
        statusText: ctx.response.statusText,
        headers,
      });
    } catch (error) {
      // 压缩失败，使用原始响应
      console.error("[Compression] 压缩失败:", error);
    }
  };
}
