/**
 * HTTP 上下文类型定义
 *
 * 定义 HttpContext 接口，用于 HTTP 请求处理
 */

import type { MiddlewareContext } from "@dreamer/middleware";

/**
 * HTTP 错误接口
 */
export interface HttpError {
  /** HTTP 状态码 */
  status: number;
  /** 错误消息 */
  message: string;
  /** 错误代码（可选） */
  code?: string;
  /** 错误详情（可选） */
  details?: unknown;
  /** 时间戳 */
  timestamp?: string;
  /** 索引签名（用于兼容 MiddlewareContext） */
  [key: string]: unknown;
}

/**
 * Cookie 选项接口
 */
export interface CookieOptions {
  /** 过期时间（毫秒） */
  maxAge?: number;
  /** 过期日期 */
  expires?: Date;
  /** 域名 */
  domain?: string;
  /** 路径（默认：/） */
  path?: string;
  /** 是否只在 HTTPS 下发送 */
  secure?: boolean;
  /** 是否禁止 JavaScript 访问 */
  httpOnly?: boolean;
  /** SameSite 策略 */
  sameSite?: "strict" | "lax" | "none";
}

/**
 * HTTP 上下文接口
 * 继承自 MiddlewareContext，扩展 HTTP 特定属性
 *
 * 注意：索引签名 [key: string]: unknown 允许动态添加属性（如 session）
 */
export interface HttpContext extends MiddlewareContext {
  /** 原始请求对象 */
  request: Request;
  /** 响应对象（中间件可以修改） */
  response?: Response;
  /** 请求路径 */
  path: string;
  /** HTTP 方法 */
  method: string;
  /** URL 对象 */
  url: URL;
  /** 请求头 */
  headers: Headers;
  /** 路由参数（由路由系统填充） */
  params?: Record<string, string>;
  /** 查询参数（从 URL 解析） */
  query?: Record<string, string>;
  /** 解析后的请求体 */
  body?: unknown;
  /** 错误信息 */
  error?: HttpError;

  /** Cookie 操作 */
  cookies: {
    /**
     * 获取 Cookie 值
     * @param name Cookie 名称
     * @returns Cookie 值，如果不存在返回 undefined
     */
    get(name: string): string | undefined;

    /**
     * 设置 Cookie
     * @param name Cookie 名称
     * @param value Cookie 值
     * @param options Cookie 选项
     */
    set(name: string, value: string, options?: CookieOptions): void;

    /**
     * 删除 Cookie（通过设置过期时间）
     * @param name Cookie 名称
     */
    remove(name: string): void;

    /**
     * 获取所有 Cookie
     * @returns 所有 Cookie 的键值对
     */
    getAll(): Record<string, string>;
  };

  // 注意：session 属性由 @dreamer/session 库通过模块增强添加
  // 索引签名允许运行时动态添加属性
}
