/**
 * @dreamer/server 类型定义
 */

/**
 * 服务器模式
 */
export type ServerMode = "dev" | "prod";
import type { Logger } from "@dreamer/logger";

/**
 * HMR 配置选项
 */
export interface HMRConfig {
  /** 是否启用 HMR */
  enabled?: boolean;
  /** WebSocket 路径 */
  path?: string;
  /** 客户端脚本路径 */
  clientScript?: string;
}

/**
 * 文件监听配置
 */
export interface WatchConfig {
  /** 监听的文件/目录路径 */
  paths?: string[];
  /** 忽略的文件/目录模式 */
  ignore?: string[];
  /** 监听选项 */
  options?: {
    /** 是否递归监听子目录 */
    recursive?: boolean;
  };
}

/**
 * 开发工具配置
 */
export interface DevConfig {
  /** HMR 配置 */
  hmr?: HMRConfig | boolean;
  /** 文件监听配置 */
  watch?: WatchConfig | string[];
  /** 构建器接口（用于增量构建） */
  builder?: {
    /** 重新构建 */
    rebuild(): Promise<
      { outputFiles?: Array<{ path: string; contents: Uint8Array }> }
    >;
  };
}

/**
 * 服务器配置选项
 */
export interface ServerOptions {
  /** 服务器模式 */
  mode?: ServerMode;
  /** 端口号 */
  port?: number;
  /** 主机名 */
  host?: string;
  /** 监听回调 */
  onListen?: (params: { host: string; port: number }) => void;
  /** 错误处理函数（可选） */
  onError?: (error: Error) => Response | Promise<Response>;
  /** Logger 实例（可选） */
  logger?: Logger;
  /** 开发工具配置（仅开发模式） */
  dev?: DevConfig;
  /** 优雅关闭超时时间（毫秒，默认：10000） */
  shutdownTimeout?: number;
}

/**
 * 服务器实例接口
 */
export interface ServerInterface {
  /** 启动服务器 */
  start(): Promise<void>;
  /** 停止服务器 */
  stop(): Promise<void>;
  /** 获取端口号 */
  readonly port: number;
  /** 获取主机名 */
  readonly host: string;
  /** 获取 HTTP 应用实例 */
  readonly http: import("./http/http.ts").Http;
}
