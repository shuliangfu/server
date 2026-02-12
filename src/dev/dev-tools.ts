/**
 * 开发工具模块
 *
 * 提供 HMR、文件监听等开发工具功能
 */

import type { FileWatcher } from "@dreamer/runtime-adapter";
import {
  IS_BUN,
  IS_DENO,
  upgradeWebSocket,
  watchFs,
} from "@dreamer/runtime-adapter";

import type { Http } from "../http/http.ts";
import type { DevConfig, HMRConfig, WatchConfig } from "../types.ts";
import { generateHMRClientScript, injectHMRClient } from "./hmr-client.ts";
import { ModuleGraphManager } from "./module-graph.ts";
import {
  createPerformanceMonitor,
  type HMRPerformanceMonitor,
} from "./performance-monitor.ts";
import { createRouteInferrer, type RouteInferrer } from "./route-inference.ts";

/** 心跳间隔（毫秒），用于保持连接活跃、避免代理断开 */
const HMR_HEARTBEAT_INTERVAL_MS = 30000;

/**
 * WebSocket 连接管理
 */
class WebSocketManager {
  private connections: Set<WebSocket> = new Set();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * 添加连接
   */
  add(ws: WebSocket): void {
    this.connections.add(ws);
    ws.onclose = () => {
      this.connections.delete(ws);
    };
    this.startHeartbeatIfNeeded();
  }

  /**
   * 若尚未启动则启动心跳定时器
   */
  private startHeartbeatIfNeeded(): void {
    if (this.heartbeatTimer !== null) return;
    this.heartbeatTimer = setInterval(() => {
      if (this.connections.size === 0) return;
      this.broadcast({ type: "ping", timestamp: Date.now() });
    }, HMR_HEARTBEAT_INTERVAL_MS);
  }

  /**
   * 广播消息
   */
  broadcast(message: unknown): void {
    const data = JSON.stringify(message);
    for (const ws of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(data);
        } catch {
          // 发送失败则忽略（连接可能已异常）
        }
      }
    }
  }

  /**
   * 关闭所有连接
   */
  close(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const ws of this.connections) {
      ws.close();
    }
    this.connections.clear();
  }
}

/**
 * 开发工具类
 *
 * 提供 HMR、文件监听等功能
 */
/** 同一路径的防抖延迟（毫秒），避免一次保存触发多次构建 */
const FILE_CHANGE_DEBOUNCE_MS = 100;

export class DevTools {
  private httpApp: Http;
  private config: DevConfig;
  private wsManager: WebSocketManager;
  private fileWatcher?: FileWatcher;
  private readonly port: number;
  /** 实际监听端口（若 start(actualPort) 传入则用于 HMR 客户端脚本等） */
  private _listeningPort?: number;
  private readonly host: string;
  private moduleGraph: ModuleGraphManager;
  private routeInferrer: RouteInferrer;
  private performanceMonitor: HMRPerformanceMonitor;
  /** 按路径防抖：path -> setTimeout 句柄，保证一次保存只触发一次构建 */
  private rebuildTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(
    options: {
      httpApp: Http;
      port: number;
      host: string;
    } & DevConfig,
  ) {
    this.httpApp = options.httpApp;
    this.config = {
      hmr: options.hmr,
      watch: options.watch,
      builder: options.builder,
    };
    this.wsManager = new WebSocketManager();
    this.port = options.port;
    this.host = options.host;
    this.moduleGraph = new ModuleGraphManager();
    this.routeInferrer = createRouteInferrer();
    this.performanceMonitor = createPerformanceMonitor();
  }

  /**
   * 启动开发工具
   *
   * @param actualPort 实际监听的端口（若因端口占用使用了 port+1 等，传入此处供 HMR 客户端脚本连接正确地址）
   */
  start(actualPort?: number): void {
    if (actualPort !== undefined) {
      this._listeningPort = actualPort;
    }

    // 设置 HMR WebSocket
    if (this.config.hmr !== false) {
      this.setupHMR();
    }

    // 启动文件监听
    if (this.config.watch) {
      this.startFileWatcher();
    }
  }

  /**
   * 停止开发工具
   */
  stop(): void {
    // 清除所有待执行的防抖定时器
    for (const timer of this.rebuildTimers.values()) {
      clearTimeout(timer);
    }
    this.rebuildTimers.clear();
    // 关闭文件监听
    if (this.fileWatcher) {
      this.fileWatcher.close();
    }
    // 关闭 WebSocket 连接
    this.wsManager.close();
    // 清空模块依赖图
    this.moduleGraph.clear();
  }

  /**
   * 获取模块依赖图管理器
   *
   * 用于外部（如构建器）更新依赖图
   *
   * @returns 模块依赖图管理器
   */
  getModuleGraph(): ModuleGraphManager {
    return this.moduleGraph;
  }

  /**
   * 获取性能监控器
   *
   * 用于获取 HMR 性能统计信息
   *
   * @returns 性能监控器
   */
  getPerformanceMonitor(): HMRPerformanceMonitor {
    return this.performanceMonitor;
  }

  /**
   * 设置 HMR WebSocket
   */
  private setupHMR(): void {
    const hmrConfig: HMRConfig = typeof this.config.hmr === "object"
      ? this.config.hmr
      : { enabled: true };

    if (hmrConfig.enabled === false) {
      return;
    }

    const hmrPath = hmrConfig.path || "/__hmr";

    // 在 HTTP 应用中注册 WebSocket 升级处理器
    this.httpApp.onWebSocket(hmrPath, (req: Request): Response => {
      try {
        if (IS_DENO || IS_BUN) {
          const { socket, response } = upgradeWebSocket(req);
          const ws = socket as WebSocket;
          this.wsManager.add(ws);
          // 连接建立后立即发送 connected，便于 DevTools 中看到连接已活跃（否则会一直显示「待处理」）
          ws.addEventListener("open", () => {
            try {
              ws.send(
                JSON.stringify({
                  type: "connected",
                  message: "HMR WebSocket 已连接",
                }),
              );
            } catch {
              // 忽略发送失败（如已关闭）
            }
          });
          return response ?? new Response(null, { status: 101 });
        }
        // 其他运行时不支持 WebSocket
        return new Response("WebSocket 不支持", { status: 426 });
      } catch (error) {
        console.error("WebSocket 升级失败:", error);
        return new Response("WebSocket 升级失败", { status: 426 });
      }
    });

    // 添加 HMR 客户端脚本注入中间件
    this.httpApp.use(async (ctx, next) => {
      await next();

      // 只处理 HTML 响应
      if (!ctx.response) {
        return;
      }

      const contentType = ctx.response.headers.get("Content-Type");
      if (!contentType || !contentType.includes("text/html")) {
        return;
      }

      // 读取响应体
      const html = await ctx.response.text();

      // 生成并注入 HMR 客户端脚本（使用实际监听端口，若已通过 start(actualPort) 传入）
      const port = this._listeningPort ?? this.port;
      const clientScript = await generateHMRClientScript(
        hmrPath,
        port,
        this.host,
      );
      const injectedHtml = injectHMRClient(html, clientScript);

      // 更新响应
      ctx.response = new Response(injectedHtml, {
        status: ctx.response.status,
        statusText: ctx.response.statusText,
        headers: ctx.response.headers,
      });
    });
  }

  /**
   * 启动文件监听
   */
  private startFileWatcher(): void {
    const watchConfig: WatchConfig = Array.isArray(this.config.watch)
      ? { paths: this.config.watch }
      : this.config.watch || { paths: ["./src"] };

    if (!watchConfig.paths || watchConfig.paths.length === 0) {
      return;
    }

    this.fileWatcher = watchFs(watchConfig.paths, {
      recursive: watchConfig.options?.recursive ?? true,
    });

    // 判断路径是否被 ignore 规则命中（规则为子串匹配，路径统一用 /）
    const isIgnored = (filePath: string): boolean => {
      if (!watchConfig.ignore || watchConfig.ignore.length === 0) {
        return false;
      }
      const normalized = filePath.replace(/\\/g, "/");
      return watchConfig.ignore.some(
        (pattern) => normalized.includes(pattern.replace(/\\/g, "/")),
      );
    };

    // 执行一次构建并广播（供防抖后调用）
    const runRebuildForPath = (path: string, updateType: string): void => {
      this.rebuildTimers.delete(path);
      if (!this.config.builder) {
        const route = this.inferRouteFromPath(path);
        this.wsManager.broadcast({
          type: updateType === "css-update" ? "css-update" : "reload",
          path,
          route,
        });
        return;
      }
      this.performanceMonitor.startUpdate([path], updateType);
      this.config.builder
        .rebuild({ changedPath: path })
        .then((result) => {
          const route = this.inferRouteFromPath(path);
          const affectedModules = this.moduleGraph.getAffectedModules(path);
          const moduleId = this.moduleGraph.getModuleId(path);
          const updateMessage: Record<string, unknown> = {
            type: updateType,
            path,
            files: result.outputFiles,
            route,
            moduleId,
            affectedModules,
            chunkUrl: result.chunkUrl,
            routePath: (result as { routePath?: string }).routePath,
          };
          if (updateType === "config-update") {
            updateMessage.type = "reload";
          } else if (updateType === "component-update") {
            updateMessage.componentPath = path;
          } else if (updateType === "layout-update") {
            updateMessage.layoutPath = path;
          } else if (updateType === "module-update") {
            updateMessage.moduleId = path;
          }
          this.wsManager.broadcast(updateMessage);
          this.performanceMonitor.endUpdate(true);
        })
        .catch((error) => {
          console.error("构建失败:", error);
          this.wsManager.broadcast({
            type: "error",
            message: error instanceof Error ? error.message : String(error),
          });
          this.performanceMonitor.endUpdate(
            false,
            error instanceof Error ? error.message : String(error),
          );
        });
    };

    // 使用异步迭代器监听文件变化，按路径防抖后只触发一次构建
    (async () => {
      for await (const event of this.fileWatcher!) {
        if (event.kind === "modify" || event.kind === "create") {
          const path = event.paths?.[0] || "";
          if (isIgnored(path)) {
            continue;
          }
          const updateType = this.determineUpdateType(path);

          const existing = this.rebuildTimers.get(path);
          if (existing !== undefined) {
            clearTimeout(existing);
          }
          const timer = setTimeout(() => {
            // 定时器触发后立即从 map 移除，防止 rebuildTimers 无界增长导致内存泄漏
            this.rebuildTimers.delete(path);
            runRebuildForPath(path, updateType);
          }, FILE_CHANGE_DEBOUNCE_MS);
          this.rebuildTimers.set(path, timer);
        }
      }
    })().catch((error) => {
      console.error("文件监听错误:", error);
    });
  }

  /**
   * 确定更新类型
   *
   * 根据文件路径和扩展名确定 HMR 更新类型
   *
   * @param filePath 文件路径
   * @returns 更新类型
   */
  private determineUpdateType(filePath: string): string {
    // 配置文件需要全量刷新
    if (this.isConfigFile(filePath)) {
      return "config-update";
    }

    // CSS 文件
    if (filePath.endsWith(".css")) {
      return "css-update";
    }

    // 使用路由推断器判断文件类型
    if (this.routeInferrer.isLayoutFile(filePath)) {
      return "layout-update";
    }

    if (this.routeInferrer.isPageFile(filePath)) {
      return "component-update";
    }

    if (this.routeInferrer.isComponentFile(filePath)) {
      return "component-update";
    }

    // 其他 JS/TS 文件视为模块更新
    if (/\.(ts|js|mjs|tsx|jsx)$/.test(filePath)) {
      return "module-update";
    }

    // 默认使用通用更新
    return "update";
  }

  /**
   * 检查文件是否是配置文件
   *
   * 配置文件变化时需要全量刷新
   *
   * @param filePath 文件路径
   * @returns 是否是配置文件
   */
  private isConfigFile(filePath: string): boolean {
    const configPatterns = [
      /deno\.json$/i,
      /package\.json$/i,
      /tsconfig\.json$/i,
      /vite\.config\.(ts|js)$/i,
      /webpack\.config\.(ts|js)$/i,
      /rollup\.config\.(ts|js)$/i,
      /esbuild\.config\.(ts|js)$/i,
      /tailwind\.config\.(ts|js)$/i,
      /\.config\.(ts|js|json)$/i,
    ];

    return configPatterns.some((pattern) => pattern.test(filePath));
  }

  /**
   * 从文件路径推断路由
   *
   * @param filePath 文件路径
   * @returns 推断的路由路径
   */
  private inferRouteFromPath(filePath: string): string {
    const route = this.routeInferrer.inferRoute(filePath);
    return route || "/";
  }
}
