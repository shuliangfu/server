/**
 * 静态文件中间件
 *
 * 提供静态文件服务
 */

import type { Middleware } from "@dreamer/middleware";
import {
  basename,
  extname,
  join,
  readFile,
  stat,
} from "@dreamer/runtime-adapter";
import type { HttpContext } from "../context.ts";
import { FileCache } from "./file-cache.ts";

/**
 * 静态文件配置选项
 */
export interface StaticFilesOptions {
  /** 静态文件根目录 */
  root: string;
  /** URL 前缀（默认：/） */
  prefix?: string;
  /** 默认文件（如 index.html） */
  index?: string | string[];
  /** 点文件处理（allow、deny、ignore） */
  dotfiles?: "allow" | "deny" | "ignore";
  /** 启用 ETag */
  etag?: boolean;
  /** 启用 Last-Modified */
  lastModified?: boolean;
  /** 缓存时间（秒） */
  maxAge?: number;
  /** 启用内存缓存（默认：true） */
  enableCache?: boolean;
  /** 缓存最大大小（字节，默认：50MB） */
  cacheMaxSize?: number;
  /** 缓存 TTL（毫秒，0 表示不过期，默认：0） */
  cacheTTL?: number;
}

/**
 * 创建静态文件中间件
 *
 * @param options 静态文件配置选项
 * @returns 静态文件中间件函数
 *
 * @example
 * ```typescript
 * app.use(staticFiles({
 *   root: "./public",
 *   prefix: "/static",
 * }));
 * ```
 */
// 全局文件缓存（每个配置一个实例）
const cacheInstances = new Map<string, FileCache>();

export function staticFiles(
  options: StaticFilesOptions,
): Middleware<HttpContext> {
  const {
    root,
    prefix = "/",
    index = ["index.html"],
    dotfiles = "ignore",
    etag = true,
    lastModified = true,
    maxAge,
    enableCache = true,
    cacheMaxSize = 50 * 1024 * 1024, // 50MB
    cacheTTL = 0, // 不过期
  } = options;

  // 获取或创建缓存实例（基于 root 和 prefix 生成唯一键）
  const cacheKey = `${root}:${prefix}`;
  let fileCache: FileCache | null = null;
  if (enableCache) {
    if (!cacheInstances.has(cacheKey)) {
      cacheInstances.set(
        cacheKey,
        new FileCache({ maxSize: cacheMaxSize, ttl: cacheTTL }),
      );
    }
    fileCache = cacheInstances.get(cacheKey)!;
  }

  return async (ctx: HttpContext, next: () => Promise<void>): Promise<void> => {
    // 只处理 GET 和 HEAD 请求
    if (ctx.method !== "GET" && ctx.method !== "HEAD") {
      await next();
      return;
    }

    // 检查路径是否匹配前缀
    if (!ctx.path.startsWith(prefix)) {
      await next();
      return;
    }

    // 移除前缀，获取文件路径
    let filePath = ctx.path.slice(prefix.length);
    // 移除前导斜杠（如果有）
    if (filePath.startsWith("/")) {
      filePath = filePath.slice(1);
    }
    if (!filePath) {
      filePath = "";
    }

    // 检查点文件
    if (basename(filePath).startsWith(".")) {
      if (dotfiles === "deny") {
        ctx.response = new Response("Forbidden", { status: 403 });
        return;
      }
      if (dotfiles === "ignore") {
        await next();
        return;
      }
    }

    try {
      // 构建完整文件路径
      let fullPath = join(root, filePath);

      // 检查文件是否存在
      let fileStat = await stat(fullPath);

      // 如果是目录，尝试查找默认文件
      if (fileStat.isDirectory) {
        const indexFiles = Array.isArray(index) ? index : [index];
        let found = false;

        for (const indexFile of indexFiles) {
          const indexPath = join(fullPath, indexFile);
          try {
            const indexStat = await stat(indexPath);
            if (indexStat.isFile) {
              fullPath = indexPath;
              fileStat = indexStat;
              found = true;
              break;
            }
          } catch {
            // 继续查找下一个
          }
        }

        if (!found) {
          await next();
          return;
        }
      }

      // 尝试从缓存获取
      let fileContent: Uint8Array;
      let contentType: string;
      let etagValue: string;

      // 检查缓存是否可用且文件未更改
      const isCacheValid = fileCache &&
        !fileCache.isStale(fullPath, fileStat.mtime);

      if (isCacheValid && fileCache) {
        // 从缓存获取
        const cached = fileCache.get(fullPath);
        if (cached) {
          fileContent = cached.content;
          contentType = cached.metadata.contentType;
          etagValue = cached.metadata.etag;
        } else {
          // 缓存未命中，读取文件
          fileContent = await readFile(fullPath);
          contentType = getContentType(fullPath);
          etagValue = generateETag(fileStat.mtime, fileStat.size);

          // 存入缓存
          fileCache.set(fullPath, fileContent, {
            size: fileStat.size,
            mtime: fileStat.mtime,
            contentType,
            etag: etagValue,
          });
        }
      } else {
        // 未启用缓存或文件已更改，读取文件
        fileContent = await readFile(fullPath);
        contentType = getContentType(fullPath);
        etagValue = generateETag(fileStat.mtime, fileStat.size);

        // 存入缓存（如果启用）
        // 如果文件已更改，先删除旧缓存项
        if (fileCache) {
          fileCache.delete(fullPath);
          fileCache.set(fullPath, fileContent, {
            size: fileStat.size,
            mtime: fileStat.mtime,
            contentType,
            etag: etagValue,
          });
        }
      }

      // 构建响应头
      const headers = new Headers();
      headers.set("Content-Type", contentType);

      // 设置 ETag
      if (etag) {
        headers.set("ETag", etagValue);

        // 检查 If-None-Match
        const ifNoneMatch = ctx.headers.get("If-None-Match");
        if (ifNoneMatch === etagValue) {
          ctx.response = new Response(null, { status: 304, headers });
          return;
        }
      }

      // 设置 Last-Modified
      if (lastModified && fileStat.mtime) {
        headers.set("Last-Modified", new Date(fileStat.mtime).toUTCString());

        // 检查 If-Modified-Since
        const ifModifiedSince = ctx.headers.get("If-Modified-Since");
        if (ifModifiedSince) {
          const modifiedSince = new Date(ifModifiedSince).getTime();
          const fileModified = new Date(fileStat.mtime).getTime();
          if (fileModified <= modifiedSince) {
            ctx.response = new Response(null, { status: 304, headers });
            return;
          }
        }
      }

      // 设置缓存控制
      if (maxAge !== undefined) {
        headers.set("Cache-Control", `public, max-age=${maxAge}`);
      }

      // 创建响应
      ctx.response = new Response(fileContent as BodyInit, {
        status: 200,
        headers,
      });
    } catch (_error) {
      // 文件不存在或其他错误，继续下一个中间件
      await next();
    }
  };
}

/**
 * 根据文件扩展名获取 Content-Type
 *
 * @param filePath 文件路径
 * @returns Content-Type
 */
function getContentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
  };

  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * 生成 ETag
 *
 * @param mtime 修改时间
 * @param size 文件大小
 * @returns ETag 值
 */
function generateETag(mtime: number | Date | null, size: number): string {
  const time = mtime instanceof Date ? mtime.getTime() : (mtime || 0);
  return `"${size}-${time}"`;
}
