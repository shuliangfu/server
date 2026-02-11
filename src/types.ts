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
  /** 构建器接口（用于增量构建，支持 HMR 无感刷新返回 chunkUrl） */
  builder?: {
    /** 重新构建，可选传入变更路径以返回对应 chunk 的 URL */
    rebuild(options?: { changedPath?: string }): Promise<
      {
        outputFiles?: Array<{ path: string; contents: Uint8Array }>;
        /** 本次变更对应路由的 chunk URL，供 HMR 无感刷新使用 */
        chunkUrl?: string;
      }
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
  /** 是否启用调试日志（默认：false），开启后会在控制台输出请求路径、路径前置处理器、中间件链、响应状态等详细调试信息 */
  debug?: boolean;
  /** 开发工具配置（仅开发模式） */
  dev?: DevConfig;
  /** 优雅关闭超时时间（毫秒，默认：10000） */
  shutdownTimeout?: number;
}

/**
 * 服务器实例接口
 */
export interface ServerInterface {
  /** 启动服务器（会检测端口占用，若占用则自动使用 port+1 等可用端口） */
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
