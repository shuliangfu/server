/**
 * 文件缓存实现（LRU Cache）
 *
 * 用于静态文件中间件的内存缓存
 */

/**
 * 缓存项
 */
interface CacheItem {
  /** 文件内容 */
  content: Uint8Array;
  /** 文件元数据 */
  metadata: {
    /** 文件大小 */
    size: number;
    /** 修改时间 */
    mtime: number | Date | null;
    /** Content-Type */
    contentType: string;
    /** ETag 值 */
    etag: string;
  };
  /** 缓存时间戳 */
  timestamp: number;
  /** 访问时间戳（用于 LRU） */
  accessTime: number;
}

/**
 * LRU 文件缓存
 */
export class FileCache {
  /** 缓存存储 */
  private cache: Map<string, CacheItem>;
  /** 最大缓存大小（字节） */
  private maxSize: number;
  /** 当前缓存大小（字节） */
  private currentSize: number;
  /** TTL（毫秒，0 表示不过期） */
  private ttl: number;

  /**
   * 创建文件缓存实例
   *
   * @param options 缓存配置选项
   */
  constructor(options: {
    /** 最大缓存大小（字节，默认：50MB） */
    maxSize?: number;
    /** TTL（毫秒，默认：0 表示不过期） */
    ttl?: number;
  } = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 50 * 1024 * 1024; // 50MB
    this.currentSize = 0;
    this.ttl = options.ttl || 0;
  }

  /**
   * 获取缓存项
   *
   * @param key 缓存键（文件路径）
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
   * @param key 缓存键（文件路径）
   * @param content 文件内容
   * @param metadata 文件元数据
   */
  set(
    key: string,
    content: Uint8Array,
    metadata: CacheItem["metadata"],
  ): void {
    const contentSize = content.length;

    // 如果单个文件超过最大缓存大小，不缓存
    if (contentSize > this.maxSize) {
      return;
    }

    // 如果缓存已满，删除最久未使用的项（LRU）
    while (
      this.currentSize + contentSize > this.maxSize && this.cache.size > 0
    ) {
      this.evictLRU();
    }

    // 如果删除后仍然无法容纳，不缓存
    if (this.currentSize + contentSize > this.maxSize) {
      return;
    }

    // 如果键已存在，先删除旧项
    const existing = this.cache.get(key);
    if (existing) {
      this.currentSize -= existing.content.length;
    }

    // 添加新项
    const now = Date.now();
    this.cache.set(key, {
      content,
      metadata,
      timestamp: now,
      accessTime: now,
    });
    this.currentSize += contentSize;
  }

  /**
   * 删除缓存项
   *
   * @param key 缓存键
   */
  delete(key: string): void {
    const item = this.cache.get(key);
    if (item) {
      this.currentSize -= item.content.length;
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

  /**
   * 检查文件是否已更改（通过比较 mtime）
   *
   * @param key 缓存键
   * @param mtime 文件修改时间
   * @returns 如果文件已更改返回 true
   */
  isStale(key: string, mtime: number | Date | null): boolean {
    const item = this.cache.get(key);
    if (!item) {
      return true;
    }

    const cachedMtime = item.metadata.mtime;
    const newMtime = mtime instanceof Date ? mtime.getTime() : (mtime || 0);
    const cachedMtimeValue = cachedMtime instanceof Date
      ? cachedMtime.getTime()
      : (cachedMtime || 0);

    return newMtime !== cachedMtimeValue;
  }
}
