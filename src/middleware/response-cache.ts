/**
 * 响应缓存中间件
 *
 * 提供 HTTP 响应缓存功能，减少重复计算，提升 API 响应速度
 */

import type { Middleware } from "@dreamer/middleware";
import type { HttpContext } from "../context.ts";

/**
 * 缓存项
 */
interface CacheItem {
  /** 响应体 */
  body: Uint8Array;
  /** 响应状态码 */
  status: number;
  /** 响应头 */
  headers: Headers;
  /** ETag 值 */
  etag?: string;
  /** Last-Modified 时间 */
  lastModified?: Date;
  /** 缓存时间戳 */
  timestamp: number;
  /** 访问时间戳（用于 LRU） */
  accessTime: number;
}

/**
 * LRU 响应缓存
 */
class ResponseCache {
  /** 缓存存储 */
  private cache: Map<string, CacheItem>;
  /** 最大缓存大小（字节） */
  private maxSize: number;
  /** 当前缓存大小（字节） */
  private currentSize: number;
  /** TTL（毫秒，0 表示不过期） */
  private ttl: number;

  /**
   * 创建响应缓存实例
   *
   * @param options 缓存配置选项
   */
  constructor(options: {
    /** 最大缓存大小（字节，默认：100MB） */
    maxSize?: number;
    /** TTL（毫秒，默认：0 表示不过期） */
    ttl?: number;
  } = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB
    this.currentSize = 0;
    this.ttl = options.ttl || 0;
  }

  /**
   * 获取缓存项
   *
   * @param key 缓存键
   * @returns 缓存项，如果不存在或已过期则返回 null
   */
  get(key: string): CacheItem | null {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    // 检查是否过期
    if (this.ttl > 0) {
      const age = Date.now() - item.timestamp;
      if (age > this.ttl) {
        this.delete(key);
        return null;
      }
    }

    // 更新访问时间（LRU）
    item.accessTime = Date.now();
    return item;
  }

  /**
   * 设置缓存项
   *
   * @param key 缓存键
   * @param item 缓存项
   */
  set(key: string, item: Omit<CacheItem, "timestamp" | "accessTime">): void {
    const bodySize = item.body.length;

    // 如果单个响应超过最大缓存大小，不缓存
    if (bodySize > this.maxSize) {
      return;
    }

    // 如果缓存已满，删除最久未使用的项（LRU）
    while (
      this.currentSize + bodySize > this.maxSize && this.cache.size > 0
    ) {
      this.evictLRU();
    }

    // 如果删除后仍然无法容纳，不缓存
    if (this.currentSize + bodySize > this.maxSize) {
      return;
    }

    // 如果键已存在，先删除旧项
    const existing = this.cache.get(key);
    if (existing) {
      this.currentSize -= existing.body.length;
    }

    // 添加新项
    const now = Date.now();
    this.cache.set(key, {
      ...item,
      timestamp: now,
      accessTime: now,
    });
    this.currentSize += bodySize;
  }

  /**
   * 删除缓存项
   *
   * @param key 缓存键
   */
  delete(key: string): void {
    const item = this.cache.get(key);
    if (item) {
      this.currentSize -= item.body.length;
      this.cache.delete(key);
    }
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    size: number;
    count: number;
    maxSize: number;
    usage: number; // 使用率（0-1）
  } {
    return {
      size: this.currentSize,
      count: this.cache.size,
      maxSize: this.maxSize,
      usage: this.maxSize > 0 ? this.currentSize / this.maxSize : 0,
    };
  }

  /**
   * 删除最久未使用的项（LRU）
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, item] of this.cache.entries()) {
      if (item.accessTime < oldestTime) {
        oldestTime = item.accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }
}

/**
 * 响应缓存配置选项
 */
export interface ResponseCacheOptions {
  /** 缓存策略（public、private、no-cache，默认：public） */
  cacheControl?: "public" | "private" | "no-cache";
  /** 缓存时间（秒，默认：3600） */
  maxAge?: number;
  /** 是否启用 ETag（默认：true） */
  etag?: boolean;
  /** 是否启用 Last-Modified（默认：true） */
  lastModified?: boolean;
  /** 最大缓存大小（字节，默认：100MB） */
  maxSize?: number;
  /** 缓存 TTL（毫秒，0 表示不过期，默认：0） */
  ttl?: number;
  /** 生成缓存键的函数（默认：基于 URL、查询参数、请求头） */
  keyGenerator?: (ctx: HttpContext) => string;
  /** 判断是否应该缓存响应的函数（默认：缓存 2xx 响应） */
  shouldCache?: (ctx: HttpContext, response: Response) => boolean;
  /** 判断是否应该跳过缓存的函数（默认：跳过 POST、PUT、DELETE、PATCH） */
  shouldSkip?: (ctx: HttpContext) => boolean;
}

/**
 * 生成 ETag
 *
 * @param data 数据
 * @returns ETag 值
 */
function generateETag(data: Uint8Array): string {
  // 简单的哈希算法（实际可以使用更复杂的算法）
  let hash = 0;
  for (let i = 0; i < Math.min(data.length, 1000); i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash; // 转换为 32 位整数
  }
  return `"${Math.abs(hash).toString(16)}"`;
}

/**
 * 默认缓存键生成函数
 *
 * @param ctx HTTP 上下文
 * @returns 缓存键
 */
function defaultKeyGenerator(ctx: HttpContext): string {
  const parts: string[] = [
    ctx.method,
    ctx.path,
  ];

  // 包含查询参数
  if (ctx.query && Object.keys(ctx.query).length > 0) {
    const queryString = Object.entries(ctx.query)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    parts.push(queryString);
  }

  // 包含相关请求头（如 Accept、Accept-Language）
  const relevantHeaders = ["accept", "accept-language", "authorization"];
  const headerValues: string[] = [];
  for (const headerName of relevantHeaders) {
    const value = ctx.headers.get(headerName);
    if (value) {
      headerValues.push(`${headerName}:${value}`);
    }
  }
  if (headerValues.length > 0) {
    parts.push(headerValues.join("|"));
  }

  return parts.join("|");
}

/**
 * 默认判断是否应该缓存响应
 *
 * @param _ctx HTTP 上下文
 * @param response 响应对象
 * @returns 是否应该缓存
 */
function defaultShouldCache(_ctx: HttpContext, response: Response): boolean {
  // 只缓存成功的响应（2xx）
  return response.status >= 200 && response.status < 300;
}

/**
 * 默认判断是否应该跳过缓存
 *
 * @param ctx HTTP 上下文
 * @returns 是否应该跳过
 */
function defaultShouldSkip(ctx: HttpContext): boolean {
  // 跳过非 GET/HEAD 请求
  return ctx.method !== "GET" && ctx.method !== "HEAD";
}

// 全局响应缓存实例（每个配置一个实例）
const cacheInstances = new Map<string, ResponseCache>();

/**
 * 创建响应缓存中间件
 *
 * @param options 响应缓存配置选项
 * @returns 响应缓存中间件函数
 *
 * @example
 * ```typescript
 * app.use(responseCache({
 *   maxAge: 3600,
 *   cacheControl: "public",
 * }));
 * ```
 */
export function responseCache(
  options: ResponseCacheOptions = {},
): Middleware<HttpContext> {
  const {
    cacheControl = "public",
    maxAge = 3600,
    etag = true,
    lastModified = true,
    maxSize = 100 * 1024 * 1024, // 100MB
    ttl = 0, // 不过期
    keyGenerator = defaultKeyGenerator,
    shouldCache = defaultShouldCache,
    shouldSkip = defaultShouldSkip,
  } = options;

  // 获取或创建缓存实例（基于配置生成唯一键）
  const cacheKey = JSON.stringify({
    maxSize,
    ttl,
    cacheControl,
    maxAge,
  });
  if (!cacheInstances.has(cacheKey)) {
    cacheInstances.set(cacheKey, new ResponseCache({ maxSize, ttl }));
  }
  const cache = cacheInstances.get(cacheKey)!;

  return async (ctx: HttpContext, next: () => Promise<void>): Promise<void> => {
    // 如果应该跳过，直接执行下一个中间件
    if (shouldSkip(ctx)) {
      await next();
      // 如果响应已创建，添加跳过标记
      if (ctx.response) {
        ctx.response.headers.set(
          "Cache-Control",
          "no-cache, no-store, must-revalidate",
        );
        ctx.response.headers.set("X-Cache", "SKIP");
      }
      return;
    }

    // 生成缓存键
    const cacheKey = keyGenerator(ctx);

    // 检查条件请求（If-None-Match、If-Modified-Since）
    const ifNoneMatch = ctx.headers.get("If-None-Match");
    const ifModifiedSince = ctx.headers.get("If-Modified-Since");

    // 尝试从缓存获取
    const cached = cache.get(cacheKey);
    if (cached) {
      // 检查 ETag（优先级高于 Last-Modified）
      if (etag && cached.etag && ifNoneMatch) {
        if (ifNoneMatch === cached.etag) {
          ctx.response = new Response(null, {
            status: 304,
            headers: cached.headers,
          });
          return;
        }
      }

      // 检查 Last-Modified（如果没有 ETag 或 ETag 不匹配）
      if (
        lastModified && cached.lastModified && ifModifiedSince
      ) {
        const modifiedSince = new Date(ifModifiedSince).getTime();
        const cachedModified = cached.lastModified.getTime();
        if (cachedModified <= modifiedSince) {
          ctx.response = new Response(null, {
            status: 304,
            headers: cached.headers,
          });
          return;
        }
      }

      // 返回缓存的响应
      const responseHeaders = new Headers(cached.headers);
      responseHeaders.set("X-Cache", "HIT");
      ctx.response = new Response(cached.body as BodyInit, {
        status: cached.status,
        headers: responseHeaders,
      });
      return;
    }

    // 缓存未命中，执行下一个中间件
    await next();

    // 如果响应已创建，检查是否应该缓存
    if (ctx.response && shouldCache(ctx, ctx.response)) {
      // 克隆响应以便读取和缓存
      const responseClone = ctx.response.clone();
      const body = await responseClone.arrayBuffer();
      const bodyBytes = new Uint8Array(body);

      // 生成 ETag
      const etagValue = etag ? generateETag(bodyBytes) : undefined;

      // 获取 Last-Modified（从响应头或使用当前时间）
      let lastModifiedValue: Date | undefined;
      if (lastModified) {
        const lastModifiedHeader = ctx.response.headers.get("Last-Modified");
        lastModifiedValue = lastModifiedHeader
          ? new Date(lastModifiedHeader)
          : new Date();
      }

      // 构建缓存响应头
      const cacheHeaders = new Headers(ctx.response.headers);
      if (etag && etagValue) {
        cacheHeaders.set("ETag", etagValue);
      }
      if (lastModified && lastModifiedValue) {
        cacheHeaders.set("Last-Modified", lastModifiedValue.toUTCString());
      }
      cacheHeaders.set("Cache-Control", `${cacheControl}, max-age=${maxAge}`);
      cacheHeaders.set("X-Cache", "MISS");

      // 存入缓存
      cache.set(cacheKey, {
        body: bodyBytes,
        status: ctx.response.status,
        headers: cacheHeaders,
        etag: etagValue,
        lastModified: lastModifiedValue,
      });

      // 更新原始响应的头
      for (const [key, value] of cacheHeaders.entries()) {
        ctx.response.headers.set(key, value);
      }
    } else if (ctx.response) {
      // 不应该缓存，但添加 Cache-Control 头
      ctx.response.headers.set(
        "Cache-Control",
        "no-cache, no-store, must-revalidate",
      );
      ctx.response.headers.set("X-Cache", "SKIP");
    }
  };
}

/**
 * 获取响应缓存统计信息
 *
 * @param options 缓存配置选项（用于定位缓存实例）
 * @returns 缓存统计信息
 */
export function getResponseCacheStats(
  options: ResponseCacheOptions = {},
): {
  size: number;
  count: number;
  maxSize: number;
  usage: number;
} {
  const cacheKey = JSON.stringify({
    maxSize: options.maxSize || 100 * 1024 * 1024,
    ttl: options.ttl || 0,
  });
  const cache = cacheInstances.get(cacheKey);
  if (cache) {
    return cache.getStats();
  }
  return {
    size: 0,
    count: 0,
    maxSize: 0,
    usage: 0,
  };
}

/**
 * 清空响应缓存
 *
 * @param options 缓存配置选项（用于定位缓存实例，如果为空则清空所有）
 */
export function clearResponseCache(
  options?: ResponseCacheOptions,
): void {
  if (options) {
    const cacheKey = JSON.stringify({
      maxSize: options.maxSize || 100 * 1024 * 1024,
      ttl: options.ttl || 0,
    });
    const cache = cacheInstances.get(cacheKey);
    if (cache) {
      cache.clear();
    }
  } else {
    // 清空所有缓存实例
    for (const cache of cacheInstances.values()) {
      cache.clear();
    }
  }
}
