/**
 * HMR 浏览器端脚本
 *
 * 用于在浏览器中连接 HMR WebSocket 并处理热更新
 *
 * 注意：这个文件会在浏览器中运行，所以不能使用服务端的 API
 *
 * 关于 renderCSR：
 * - 在浏览器环境中，无法直接导入 JSR 包
 * - 我们使用类型导入来获得类型安全，运行时从 globalThis.__RENDER_CSR__ 获取
 * - 或者应用可以在运行时动态导入并注册到全局变量
 */

// 类型定义（仅用于类型检查，不会被打包）
type RenderCSRType = typeof import("@dreamer/render/client").renderCSR;
type CSROptions = import("@dreamer/render/client").CSROptions;

interface HMRMessage {
  type:
    | "update"
    | "reload"
    | "error"
    | "css-update"
    | "component-update"
    | "layout-update"
    | "module-update";
  path?: string; // 文件路径
  files?: Array<{ path: string; contents?: Uint8Array }>;
  message?: string;
  moduleId?: string; // 更新的模块 ID
  componentPath?: string; // 更新的组件路径
  layoutPath?: string; // 更新的布局路径
  route?: string; // 更新的路由路径（用于判断是否需要更新当前页面）
}

/**
 * 更新队列项
 */
interface UpdateQueueItem {
  message: HMRMessage;
  timestamp: number;
}

/**
 * 连接状态类型
 */
type ConnectionStatus = "connected" | "disconnected" | "reconnecting" | "error";

/**
 * HMR 状态可视化 UI 类
 *
 * 提供连接状态指示器、更新进度提示和统计面板
 */
class HMRStatusUI {
  private container: HTMLElement | null = null;
  private statusIndicator: HTMLElement | null = null;
  private progressBar: HTMLElement | null = null;
  private statsPanel: HTMLElement | null = null;
  private statsButton: HTMLElement | null = null;
  private isStatsPanelOpen = false;

  // 统计信息
  private updateCount = 0;
  private successCount = 0;
  private failureCount = 0;
  private lastUpdateTime: number | null = null;

  /**
   * 初始化 UI
   */
  init(): void {
    if (typeof (globalThis as any).document === "undefined") {
      return; // 非浏览器环境，跳过
    }

    this.createContainer();
    this.createStatusIndicator();
    this.createProgressBar();
    this.createStatsPanel();
  }

  /**
   * 创建主容器
   */
  private createContainer(): void {
    const doc = (globalThis as any).document;
    if (!doc || !doc.body) return;

    this.container = doc.createElement("div");
    if (!this.container) return;

    this.container.id = "__hmr-status-container";
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 99999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      pointer-events: none;
    `;
    doc.body.appendChild(this.container);
  }

  /**
   * 创建连接状态指示器
   */
  private createStatusIndicator(): void {
    if (!this.container) return;

    const doc = (globalThis as any).document;
    if (!doc) return;

    this.statusIndicator = doc.createElement("div");
    if (!this.statusIndicator || !this.container) return;

    this.statusIndicator.id = "__hmr-status-indicator";
    this.statusIndicator.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      border-radius: 4px;
      pointer-events: auto;
      cursor: pointer;
      transition: all 0.2s;
    `;

    const dot = doc.createElement("span");
    dot.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4caf50;
      display: inline-block;
    `;

    const text = doc.createElement("span");
    text.textContent = "HMR 已连接";

    this.statusIndicator.appendChild(dot);
    this.statusIndicator.appendChild(text);
    this.container.appendChild(this.statusIndicator);

    // 点击显示统计面板
    this.statusIndicator.addEventListener("click", () => {
      this.toggleStatsPanel();
    });
  }

  /**
   * 创建更新进度条
   */
  private createProgressBar(): void {
    if (!this.container) return;

    const doc = (globalThis as any).document;
    if (!doc) return;

    this.progressBar = doc.createElement("div");
    if (!this.progressBar || !this.container) return;

    this.progressBar.id = "__hmr-progress-bar";
    this.progressBar.style.cssText = `
      width: 200px;
      height: 3px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      margin-top: 8px;
      overflow: hidden;
      display: none;
    `;

    const progressFill = doc.createElement("div");
    progressFill.style.cssText = `
      width: 0%;
      height: 100%;
      background: #4caf50;
      transition: width 0.3s;
    `;
    this.progressBar.appendChild(progressFill);
    this.container.appendChild(this.progressBar);
  }

  /**
   * 创建统计面板
   */
  private createStatsPanel(): void {
    if (!this.container) return;

    const doc = (globalThis as any).document;
    if (!doc) return;

    this.statsPanel = doc.createElement("div");
    if (!this.statsPanel || !this.container) return;

    this.statsPanel.id = "__hmr-stats-panel";
    this.statsPanel.style.cssText = `
      position: absolute;
      bottom: 100%;
      right: 0;
      margin-bottom: 8px;
      width: 280px;
      background: rgba(0, 0, 0, 0.95);
      color: white;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: none;
      pointer-events: auto;
    `;

    const title = doc.createElement("div");
    title.textContent = "HMR 统计";
    title.style.cssText = `
      font-weight: 600;
      margin-bottom: 12px;
      font-size: 14px;
    `;

    const statsContent = doc.createElement("div");
    statsContent.id = "__hmr-stats-content";
    statsContent.style.cssText = `
      font-size: 12px;
      line-height: 1.6;
    `;

    this.statsPanel.appendChild(title);
    this.statsPanel.appendChild(statsContent);
    this.container.appendChild(this.statsPanel);
  }

  /**
   * 更新连接状态
   */
  updateConnectionStatus(status: ConnectionStatus): void {
    if (!this.statusIndicator) return;

    const dot = this.statusIndicator.querySelector("span") as HTMLElement;
    const text = this.statusIndicator.querySelector(
      "span:last-child",
    ) as HTMLElement;

    if (!dot || !text) return;

    switch (status) {
      case "connected":
        dot.style.background = "#4caf50";
        text.textContent = "HMR 已连接";
        break;
      case "disconnected":
        dot.style.background = "#9e9e9e";
        text.textContent = "HMR 已断开";
        break;
      case "reconnecting":
        dot.style.background = "#ff9800";
        text.textContent = "HMR 重连中...";
        break;
      case "error":
        dot.style.background = "#f44336";
        text.textContent = "HMR 错误";
        break;
    }
  }

  /**
   * 显示更新进度
   */
  showProgress(_filePath: string): void {
    if (!this.progressBar) return;

    const progressFill = this.progressBar.querySelector("div") as HTMLElement;
    if (!progressFill) return;

    this.progressBar.style.display = "block";
    progressFill.style.width = "30%";

    // 模拟进度
    setTimeout(() => {
      progressFill.style.width = "70%";
    }, 100);

    setTimeout(() => {
      progressFill.style.width = "100%";
    }, 200);
  }

  /**
   * 隐藏更新进度
   */
  hideProgress(): void {
    if (!this.progressBar) return;

    const progressFill = this.progressBar.querySelector("div") as HTMLElement;
    if (progressFill) {
      progressFill.style.width = "0%";
    }

    setTimeout(() => {
      if (this.progressBar) {
        this.progressBar.style.display = "none";
      }
    }, 300);
  }

  /**
   * 记录更新
   */
  recordUpdate(success: boolean): void {
    this.updateCount++;
    if (success) {
      this.successCount++;
    } else {
      this.failureCount++;
    }
    this.lastUpdateTime = Date.now();
    this.updateStatsContent();
  }

  /**
   * 更新统计内容
   */
  private updateStatsContent(): void {
    if (!this.statsPanel) return;

    const statsContent = this.statsPanel.querySelector("#__hmr-stats-content");
    if (!statsContent) return;

    const successRate = this.updateCount > 0
      ? ((this.successCount / this.updateCount) * 100).toFixed(1)
      : "0.0";

    const lastUpdateText = this.lastUpdateTime
      ? new Date(this.lastUpdateTime).toLocaleTimeString()
      : "无";

    statsContent.innerHTML = `
      <div style="margin-bottom: 8px;">
        <span style="opacity: 0.7;">总更新次数:</span>
        <span style="margin-left: 8px; font-weight: 600;">${this.updateCount}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="opacity: 0.7;">成功:</span>
        <span style="margin-left: 8px; color: #4caf50; font-weight: 600;">${this.successCount}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="opacity: 0.7;">失败:</span>
        <span style="margin-left: 8px; color: #f44336; font-weight: 600;">${this.failureCount}</span>
      </div>
      <div style="margin-bottom: 8px;">
        <span style="opacity: 0.7;">成功率:</span>
        <span style="margin-left: 8px; font-weight: 600;">${successRate}%</span>
      </div>
      <div>
        <span style="opacity: 0.7;">最后更新:</span>
        <span style="margin-left: 8px;">${lastUpdateText}</span>
      </div>
    `;
  }

  /**
   * 切换统计面板显示
   */
  private toggleStatsPanel(): void {
    if (!this.statsPanel) return;

    this.isStatsPanelOpen = !this.isStatsPanelOpen;
    this.statsPanel.style.display = this.isStatsPanelOpen ? "block" : "none";

    if (this.isStatsPanelOpen) {
      this.updateStatsContent();
    }
  }

  /**
   * 销毁 UI
   */
  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.statusIndicator = null;
    this.progressBar = null;
    this.statsPanel = null;
  }
}

/**
 * HMR 客户端类
 */
class HMRClient {
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // 初始延迟
  private readonly maxReconnectDelay = 30000; // 最大延迟 30 秒
  private readonly reconnectDelayMultiplier = 1.5; // 指数退避倍数

  // 更新队列和批处理
  private updateQueue: UpdateQueueItem[] = [];
  private queueTimer: number | null = null;
  private readonly queueDebounceDelay = 100; // 100ms 批处理延迟

  // 状态保持
  private componentStateCache: Map<string, unknown> = new Map();
  private renderInstance: any = null; // 当前渲染实例（用于状态保持）

  // 模块备份和回滚
  private moduleBackups: Map<string, unknown> = new Map(); // 模块 ID -> 备份的模块
  private updateHistory: Array<{
    moduleId: string;
    timestamp: number;
    success: boolean;
  }> = []; // 更新历史记录

  // 状态可视化 UI
  private statusUI: HMRStatusUI;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
    this.statusUI = new HMRStatusUI();
  }

  /**
   * 连接到 WebSocket 服务器
   */
  connect(): void {
    // 初始化状态 UI（如果还没有初始化）
    if (typeof (globalThis as any).document !== "undefined") {
      this.statusUI.init();
    }

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log("[HMR] 已连接到开发服务器");
        // 连接成功，重置重连计数和延迟
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        // 更新 UI 状态
        this.statusUI.updateConnectionStatus("connected");
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message: HMRMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error("[HMR] 解析消息失败:", error);
        }
      };

      this.ws.onerror = (error: Event) => {
        console.error("[HMR] WebSocket 错误:", error);
        // 更新 UI 状态
        this.statusUI.updateConnectionStatus("error");
      };

      this.ws.onclose = () => {
        console.log("[HMR] 连接已关闭");
        this.ws = null;
        // 更新 UI 状态
        this.statusUI.updateConnectionStatus("disconnected");
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error("[HMR] 连接失败:", error);
      this.scheduleReconnect();
    }
  }

  /**
   * 安排重新连接（使用指数退避策略）
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;

      // 计算延迟时间（指数退避）
      const delay = Math.min(
        this.reconnectDelay *
          Math.pow(this.reconnectDelayMultiplier, this.reconnectAttempts - 1),
        this.maxReconnectDelay,
      );

      // 更新 UI 状态
      this.statusUI.updateConnectionStatus("reconnecting");

      this.reconnectTimer = setTimeout(() => {
        console.log(
          `[HMR] 尝试重新连接... (${this.reconnectAttempts}/${this.maxReconnectAttempts})，延迟 ${
            Math.round(delay)
          }ms`,
        );
        this.connect();
      }, delay);
    } else {
      console.error("[HMR] 达到最大重连次数，停止重连");
      // 重置延迟，以便下次连接时重新开始
      this.reconnectDelay = 1000;
      this.reconnectAttempts = 0;
    }
  }

  /**
   * 处理消息
   */
  private handleMessage(message: HMRMessage): void {
    // 立即处理的消息类型（不需要批处理）
    if (message.type === "reload" || message.type === "error") {
      switch (message.type) {
        case "reload":
          console.log("[HMR] 重新加载页面");
          // 显示进度
          if (message.path) {
            this.statusUI.showProgress(message.path);
          }
          globalThis.location.reload();
          break;

        case "error":
          console.error("[HMR] 构建错误:", message.message);
          // 记录失败
          this.statusUI.recordUpdate(false);
          break;
      }
      return;
    }

    // 其他消息类型加入队列进行批处理
    this.addToQueue(message);
  }

  /**
   * 将消息添加到更新队列
   *
   * @param message HMR 消息
   */
  private addToQueue(message: HMRMessage): void {
    // 添加到队列
    this.updateQueue.push({
      message,
      timestamp: Date.now(),
    });

    // 清除之前的定时器
    if (this.queueTimer !== null) {
      clearTimeout(this.queueTimer);
    }

    // 设置新的定时器（批处理延迟）
    this.queueTimer = setTimeout(() => {
      this.processQueue();
    }, this.queueDebounceDelay);
  }

  /**
   * 处理更新队列
   *
   * 合并多个更新消息，按优先级处理
   */
  private processQueue(): void {
    if (this.updateQueue.length === 0) {
      return;
    }

    // 清空定时器
    if (this.queueTimer !== null) {
      clearTimeout(this.queueTimer);
      this.queueTimer = null;
    }

    // 合并队列中的消息
    const merged = this.mergeUpdates(
      this.updateQueue.map((item) => item.message),
    );

    // 清空队列
    this.updateQueue = [];

    // 处理合并后的消息
    this.handleMergedUpdate(merged);
  }

  /**
   * 合并多个更新消息
   *
   * @param messages 消息列表
   * @returns 合并后的消息
   */
  private mergeUpdates(messages: HMRMessage[]): HMRMessage {
    if (messages.length === 0) {
      throw new Error("消息列表为空");
    }

    if (messages.length === 1) {
      return messages[0];
    }

    // 按优先级排序：reload > error > css-update > component-update > layout-update > module-update > update
    const priority: Record<string, number> = {
      reload: 0,
      error: 1,
      "css-update": 2,
      "component-update": 3,
      "layout-update": 4,
      "module-update": 5,
      update: 6,
    };

    // 找到优先级最高的消息类型
    const sortedMessages = messages.sort((a, b) => {
      const aPriority = priority[a.type] ?? 999;
      const bPriority = priority[b.type] ?? 999;
      return aPriority - bPriority;
    });

    const primaryMessage = sortedMessages[0];

    // 合并所有消息的路径和文件
    const allPaths = new Set<string>();
    const allFiles: Array<{ path: string; contents?: Uint8Array }> = [];
    const allRoutes = new Set<string>();

    for (const msg of messages) {
      if (msg.path) {
        allPaths.add(msg.path);
      }
      if (msg.files) {
        allFiles.push(...msg.files);
      }
      if (msg.route) {
        allRoutes.add(msg.route);
      }
    }

    // 构建合并后的消息
    const merged: HMRMessage = {
      ...primaryMessage,
      path: Array.from(allPaths)[0] || primaryMessage.path,
      files: allFiles.length > 0 ? allFiles : primaryMessage.files,
      route: Array.from(allRoutes)[0] || primaryMessage.route,
    };

    // 如果有多条消息，记录日志
    if (messages.length > 1) {
      console.log(
        `[HMR] 合并 ${messages.length} 个更新消息，主要类型: ${primaryMessage.type}`,
      );
    }

    return merged;
  }

  /**
   * 组件/布局/模块更新：开发模式下客户端为单 bundle，import 拿到的是旧模块，
   * 无法真正无感替换。直接整页重载以加载服务端已重建的 client.js，确保页面显示最新内容。
   */
  private doSeamlessUpdate(): void {
    this.statusUI.recordUpdate(true);
    this.statusUI.hideProgress();
    globalThis.location.reload();
  }

  /**
   * 处理合并后的更新消息
   *
   * @param message 合并后的消息
   */
  private handleMergedUpdate(message: HMRMessage): void {
    switch (message.type) {
      case "update":
        console.log("[HMR] 检测到更新:", message.path);
        this.handleUpdate(message);
        break;

      case "css-update":
        console.log("[HMR] CSS 文件更新:", message.path);
        this.handleCSSUpdate(message);
        break;

      case "component-update":
        console.log("[HMR] 组件更新，整页重载:", message.componentPath);
        this.statusUI.showProgress(message.componentPath || message.path || "");
        this.doSeamlessUpdate();
        break;

      case "layout-update":
        console.log("[HMR] 布局更新，整页重载:", message.layoutPath);
        this.statusUI.showProgress(message.layoutPath || message.path || "");
        this.doSeamlessUpdate();
        break;

      case "module-update":
        console.log("[HMR] 模块更新，整页重载:", message.path);
        this.statusUI.showProgress(message.path || "");
        this.doSeamlessUpdate();
        break;

      default:
        console.log("[HMR] 未知消息类型:", message.type);
    }
  }

  /**
   * 处理更新消息
   *
   * 尝试进行模块热替换，如果失败则刷新页面
   */
  private handleUpdate(message: HMRMessage): void {
    // 显示更新进度
    if (message.path) {
      this.statusUI.showProgress(message.path);
    }

    // 0. 检查路由是否匹配（如果提供了路由信息）
    if (message.route && !this.isCurrentRoute(message.route)) {
      console.log(
        `[HMR] 更新的路由 "${message.route}" 与当前路由不匹配，跳过更新`,
      );
      // 隐藏进度（因为跳过了更新）
      this.statusUI.hideProgress();
      return;
    }

    // 1. 尝试使用框架的 HMR API（如 Vite、Webpack）
    if (
      typeof (globalThis as any).module !== "undefined" &&
      (globalThis as any).module.hot
    ) {
      (globalThis as any).module.hot.accept(() => {
        console.log("[HMR] 模块已更新");
      });
      return;
    }

    // 2. 尝试使用 Vite 的 HMR API
    if (typeof (globalThis as any).import !== "undefined") {
      const viteHmr =
        (globalThis as any).__vite_plugin_react_preamble_installed__;
      if (viteHmr) {
        // Vite 会自动处理 HMR
        return;
      }
    }

    // 3. 尝试动态加载更新的模块
    if (message.files && message.files.length > 0) {
      this.loadUpdatedModules(message.files).catch((error) => {
        console.error("[HMR] 加载更新模块失败:", error);
        // 加载失败，刷新页面
        globalThis.location.reload();
      });
      return;
    }

    // 4. 如果更新的是组件或布局，尝试重新渲染
    if (message.componentPath || message.layoutPath) {
      try {
        this.reloadComponentOrLayout(message);
      } catch (error) {
        console.error("[HMR] 重新渲染组件/布局失败:", error);
        // 重新渲染失败，刷新页面
        globalThis.location.reload();
      }
      return;
    }

    // 5. 如果都不支持，刷新页面
    console.log("[HMR] 不支持模块热替换，刷新页面");
    globalThis.location.reload();
  }

  /**
   * 加载更新的模块
   *
   * @param files 更新的文件列表
   */
  private async loadUpdatedModules(
    files: Array<{ path: string; contents?: Uint8Array }>,
  ): Promise<void> {
    const moduleIds: string[] = [];
    const failedModules: string[] = [];

    // 动态导入更新的模块
    for (const file of files) {
      if (file.path.endsWith(".js") || file.path.endsWith(".mjs")) {
        const moduleId = file.path;
        moduleIds.push(moduleId);

        try {
          // 备份当前模块（如果已加载）
          this.backupModule(moduleId);

          // 添加时间戳避免缓存
          const url = `${file.path}?t=${Date.now()}`;
          await (globalThis as any).import(url);
          console.log(`[HMR] 已加载更新模块: ${file.path}`);

          // 记录成功
          this.recordUpdate(moduleId, true);
        } catch (error) {
          console.error(`[HMR] 加载模块失败 ${file.path}:`, error);
          failedModules.push(moduleId);

          // 记录失败并尝试回滚
          this.recordUpdate(moduleId, false);
          await this.rollbackModule(moduleId);

          // 显示错误提示（不强制刷新）
          this.showErrorNotification(
            `模块更新失败: ${file.path}`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    }

    // 如果有失败的模块，但不强制刷新
    if (failedModules.length > 0) {
      console.warn(
        `[HMR] ${failedModules.length} 个模块更新失败，已回滚`,
      );
    }

    // 触发全局更新事件，让应用框架处理重新渲染
    globalThis.dispatchEvent(
      new CustomEvent("hmr:update", { detail: { files } }),
    );
  }

  /**
   * 重新加载组件或布局
   *
   * @param message HMR 消息
   */
  private reloadComponentOrLayout(message: HMRMessage): void {
    // 再次检查路由（双重检查，确保路由匹配）
    if (message.route && !this.isCurrentRoute(message.route)) {
      console.log(
        `[HMR] 更新的路由 "${message.route}" 与当前路由不匹配，跳过组件/布局更新`,
      );
      return;
    }

    // 触发自定义事件，让应用框架处理组件/布局的重新渲染
    const event = new CustomEvent("hmr:component-update", {
      detail: {
        componentPath: message.componentPath,
        layoutPath: message.layoutPath,
        path: message.path,
        route: message.route,
      },
    });
    globalThis.dispatchEvent(event);

    // 如果应用框架没有监听这个事件，等待一段时间后刷新页面
    setTimeout(() => {
      if (!event.defaultPrevented) {
        console.log("[HMR] 应用未处理组件更新事件，刷新页面");
        globalThis.location.reload();
      }
    }, 100);
  }

  /**
   * 检查给定的路由是否与当前页面路由匹配
   *
   * @param route 要检查的路由路径
   * @returns 如果路由匹配返回 true，否则返回 false
   */
  private isCurrentRoute(route: string): boolean {
    // 1. 优先从 window.__RENDER_DATA__ 获取当前路由（由 @dreamer/render 的 renderCSR/hydrate 注入）
    // 这是最可靠的数据源，因为它在 CSR 和 Hydration 场景下都存在
    if (
      typeof (globalThis as any).__RENDER_DATA__ !== "undefined" &&
      (globalThis as any).__RENDER_DATA__ !== null
    ) {
      const renderData = (globalThis as any).__RENDER_DATA__;
      // 从 loadContext 中获取 url（包含完整路径）
      if (renderData.loadContext?.url) {
        const currentPath =
          renderData.loadContext.url.split("?")[0].split("#")[0];
        return this.normalizeRoute(currentPath) === this.normalizeRoute(route);
      }
    }

    // 2. 从 URL 路径获取当前路由（后备方案）
    const currentPath = globalThis.location.pathname;
    const normalizedCurrentPath = this.normalizeRoute(currentPath);
    const normalizedRoute = this.normalizeRoute(route);

    // 精确匹配
    if (normalizedCurrentPath === normalizedRoute) {
      return true;
    }

    // 支持动态路由匹配（如 /user/:id 匹配 /user/123）
    // 这里使用简单的路径段匹配
    const currentSegments = normalizedCurrentPath.split("/").filter(Boolean);
    const routeSegments = normalizedRoute.split("/").filter(Boolean);

    if (currentSegments.length !== routeSegments.length) {
      return false;
    }

    // 比较路径段，支持 :param 和 * 通配符
    for (let i = 0; i < routeSegments.length; i++) {
      const routeSegment = routeSegments[i];
      const currentSegment = currentSegments[i];

      // 如果是参数段（:param）或通配符（*），跳过
      if (routeSegment.startsWith(":") || routeSegment === "*") {
        continue;
      }

      // 精确匹配
      if (routeSegment !== currentSegment) {
        return false;
      }
    }

    return true;
  }

  /**
   * 规范化路由路径
   *
   * 移除尾随斜杠，统一格式
   *
   * @param route 路由路径
   * @returns 规范化后的路由路径
   */
  private normalizeRoute(route: string): string {
    if (!route) {
      return "/";
    }

    // 移除查询参数和哈希
    const path = route.split("?")[0].split("#")[0];

    // 确保以 / 开头
    const normalized = path.startsWith("/") ? path : `/${path}`;

    // 移除尾随斜杠（除非是根路径）
    return normalized === "/" ? "/" : normalized.replace(/\/$/, "");
  }

  /**
   * 处理 CSS 文件更新
   *
   * @param message HMR 消息
   */
  private handleCSSUpdate(message: HMRMessage): void {
    if (!message.path) {
      return;
    }

    // 显示更新进度
    this.statusUI.showProgress(message.path);

    // 查找现有的 <link> 标签
    const linkTag = this.findLinkTag(message.path);

    if (linkTag) {
      // 更新 href（添加时间戳避免缓存）
      const currentHref = linkTag.getAttribute("href") || "";
      const baseHref = currentHref.split("?")[0] || message.path;
      const newHref = `${baseHref}?t=${Date.now()}`;
      linkTag.setAttribute("href", newHref);
      console.log(`[HMR] CSS 已更新: ${message.path}`);
    } else {
      // 如果没有找到，创建新的 <link> 标签
      const newLink = (globalThis as any).document.createElement("link");
      newLink.rel = "stylesheet";
      newLink.href = `${message.path}?t=${Date.now()}`;
      (globalThis as any).document.head.appendChild(newLink);
      console.log(`[HMR] CSS 已注入: ${message.path}`);
    }

    // 记录成功更新
    this.statusUI.recordUpdate(true);
    // 隐藏进度
    setTimeout(() => {
      this.statusUI.hideProgress();
    }, 300);
  }

  /**
   * 查找 <link> 标签
   *
   * @param cssPath CSS 文件路径
   * @returns 找到的 <link> 标签，如果不存在则返回 null
   */
  private findLinkTag(cssPath: string): any {
    // 提取文件名（不包含路径）
    const fileName = cssPath.split("/").pop() || cssPath;

    // 方法1：通过完整路径匹配
    const linkByFullPath = (globalThis as any).document.querySelector(
      `link[href*="${cssPath}"]`,
    ) as any;
    if (linkByFullPath) {
      return linkByFullPath;
    }

    // 方法2：通过文件名匹配
    const linkByFileName = (globalThis as any).document.querySelector(
      `link[href*="${fileName}"]`,
    ) as any;
    if (linkByFileName) {
      return linkByFileName;
    }

    return null;
  }

  /**
   * 处理组件更新
   *
   * @param message HMR 消息
   */
  private handleComponentUpdate(message: HMRMessage): void {
    // 显示更新进度
    if (message.path || message.componentPath) {
      this.statusUI.showProgress(message.path || message.componentPath || "");
    }

    // 检查路由是否匹配
    if (message.route && !this.isCurrentRoute(message.route)) {
      console.log(
        `[HMR] 更新的路由 "${message.route}" 与当前路由不匹配，跳过组件更新`,
      );
      // 隐藏进度（因为跳过了更新）
      this.statusUI.hideProgress();
      return;
    }

    // 尝试使用 @dreamer/render 重新渲染组件
    this.tryRenderCSR(message)
      .then(() => {
        // 记录成功更新
        this.statusUI.recordUpdate(true);
        // 隐藏进度
        setTimeout(() => {
          this.statusUI.hideProgress();
        }, 300);
      })
      .catch((error) => {
        console.error("[HMR] 使用 @dreamer/render 重新渲染组件失败:", error);
        // 记录失败
        this.statusUI.recordUpdate(false);
        // 隐藏进度
        this.statusUI.hideProgress();
        // 如果失败，触发组件更新事件作为后备方案
        this.triggerComponentUpdateEvent(message);
      });
  }

  /**
   * 尝试使用 @dreamer/render 重新渲染组件
   *
   * @param message HMR 消息
   */
  private async tryRenderCSR(message: HMRMessage): Promise<void> {
    // 获取 renderCSR 函数（优先尝试动态导入，否则使用全局变量）
    const renderCSR = await this.getRenderCSR();
    if (!renderCSR) {
      // 如果无法获取 renderCSR，触发事件让应用处理
      this.triggerComponentUpdateEvent(message);
      return;
    }

    try {
      const renderData = (globalThis as any).__RENDER_DATA__;

      if (!renderData) {
        console.warn("[HMR] 未找到渲染数据，使用事件方式更新");
        this.triggerComponentUpdateEvent(message);
        return;
      }

      // 保存当前状态
      const savedState = this.saveComponentState();

      // 动态导入更新的组件
      if (message.componentPath) {
        const newComponent = await (globalThis as any).import(
          `${message.componentPath}?t=${Date.now()}`,
        );

        // 使用 @dreamer/render 重新渲染
        const result = await renderCSR({
          engine: renderData.engine || "react",
          component: newComponent.default || newComponent,
          props: renderData.props || {},
          layouts: renderData.layouts || [],
          container: renderData.container || "#app",
          skipLayouts: renderData.skipLayouts || false,
        });

        // 保存新的渲染实例
        this.renderInstance = result;

        // 恢复状态
        this.restoreComponentState(savedState);

        console.log("[HMR] 组件已通过 @dreamer/render 重新渲染（状态已保持）");
      }
    } catch (error) {
      console.error("[HMR] 重新渲染组件失败:", error);
      throw error;
    }
  }

  /**
   * 触发组件更新事件（后备方案）
   *
   * @param message HMR 消息
   */
  private triggerComponentUpdateEvent(message: HMRMessage): void {
    // 触发组件更新事件
    const event = new CustomEvent("hmr:component-update", {
      detail: {
        componentPath: message.componentPath,
        path: message.path,
        route: message.route,
      },
    });
    globalThis.dispatchEvent(event);

    // 如果应用框架没有监听这个事件，等待一段时间后刷新页面
    setTimeout(() => {
      if (!event.defaultPrevented) {
        console.log("[HMR] 应用未处理组件更新事件，刷新页面");
        globalThis.location.reload();
      }
    }, 100);
  }

  /**
   * 处理布局更新
   *
   * @param message HMR 消息
   */
  private handleLayoutUpdate(message: HMRMessage): void {
    // 显示更新进度
    if (message.path || message.layoutPath) {
      this.statusUI.showProgress(message.path || message.layoutPath || "");
    }

    // 检查路由是否匹配
    if (message.route && !this.isCurrentRoute(message.route)) {
      console.log(
        `[HMR] 更新的路由 "${message.route}" 与当前路由不匹配，跳过布局更新`,
      );
      // 隐藏进度（因为跳过了更新）
      this.statusUI.hideProgress();
      return;
    }

    // 尝试使用 @dreamer/render 重新渲染布局
    this.tryRenderCSRWithLayout(message)
      .then(() => {
        // 记录成功更新
        this.statusUI.recordUpdate(true);
        // 隐藏进度
        setTimeout(() => {
          this.statusUI.hideProgress();
        }, 300);
      })
      .catch((error) => {
        console.error("[HMR] 使用 @dreamer/render 重新渲染布局失败:", error);
        // 记录失败
        this.statusUI.recordUpdate(false);
        // 隐藏进度
        this.statusUI.hideProgress();
        // 如果失败，触发布局更新事件作为后备方案
        this.triggerLayoutUpdateEvent(message);
      });
  }

  /**
   * 尝试使用 @dreamer/render 重新渲染布局
   *
   * @param message HMR 消息
   */
  private async tryRenderCSRWithLayout(message: HMRMessage): Promise<void> {
    // 获取 renderCSR 函数（优先尝试动态导入，否则使用全局变量）
    const renderCSR = await this.getRenderCSR();
    if (!renderCSR) {
      // 如果无法获取 renderCSR，触发事件让应用处理
      this.triggerLayoutUpdateEvent(message);
      return;
    }

    try {
      const renderData = (globalThis as any).__RENDER_DATA__;

      if (!renderData) {
        console.warn("[HMR] 未找到渲染数据，使用事件方式更新");
        this.triggerLayoutUpdateEvent(message);
        return;
      }

      // 动态导入更新的布局
      if (message.layoutPath) {
        const newLayout = await (globalThis as any).import(
          `${message.layoutPath}?t=${Date.now()}`,
        );

        // 更新布局列表
        const updatedLayouts = [...(renderData.layouts || [])];
        // 找到对应的布局并更新（这里简化处理，实际可能需要更复杂的匹配逻辑）
        const layoutIndex = updatedLayouts.findIndex(
          (layout: any) => layout.componentPath === message.layoutPath,
        );
        if (layoutIndex !== -1) {
          updatedLayouts[layoutIndex] = {
            ...updatedLayouts[layoutIndex],
            component: newLayout.default || newLayout,
          };
        }

        // 保存当前状态
        const savedState = this.saveComponentState();

        // 使用 @dreamer/render 重新渲染
        const result = await renderCSR({
          engine: renderData.engine || "react",
          component: renderData.component,
          props: renderData.props || {},
          layouts: updatedLayouts,
          container: renderData.container || "#app",
          skipLayouts: renderData.skipLayouts || false,
        });

        // 保存新的渲染实例
        this.renderInstance = result;

        // 恢复状态
        this.restoreComponentState(savedState);

        console.log("[HMR] 布局已通过 @dreamer/render 重新渲染（状态已保持）");
      }
    } catch (error) {
      console.error("[HMR] 重新渲染布局失败:", error);
      throw error;
    }
  }

  /**
   * 触发布局更新事件（后备方案）
   *
   * @param message HMR 消息
   */
  private triggerLayoutUpdateEvent(message: HMRMessage): void {
    // 触发布局更新事件
    const event = new CustomEvent("hmr:layout-update", {
      detail: {
        layoutPath: message.layoutPath,
        path: message.path,
        route: message.route,
      },
    });
    globalThis.dispatchEvent(event);

    // 如果应用框架没有监听这个事件，等待一段时间后刷新页面
    setTimeout(() => {
      if (!event.defaultPrevented) {
        console.log("[HMR] 应用未处理布局更新事件，刷新页面");
        globalThis.location.reload();
      }
    }, 100);
  }

  /**
   * 保存组件状态
   *
   * 保存当前页面的状态，包括：
   * - 滚动位置
   * - 表单输入值
   * - 组件实例状态（如果可访问）
   *
   * @returns 保存的状态对象
   */
  private saveComponentState(): Record<string, unknown> {
    const state: Record<string, unknown> = {};

    // 1. 保存滚动位置
    state.scrollX = (globalThis as any).window?.scrollX || 0;
    state.scrollY = (globalThis as any).window?.scrollY || 0;

    // 2. 保存表单输入值
    const formData: Record<string, unknown> = {};
    const inputs = (globalThis as any).document?.querySelectorAll(
      "input, textarea, select",
    ) || [];
    for (const input of inputs) {
      const name = input.name || input.id;
      if (name) {
        if (input.type === "checkbox" || input.type === "radio") {
          formData[name] = input.checked;
        } else {
          formData[name] = input.value;
        }
      }
    }
    state.formData = formData;

    // 3. 保存组件实例状态（如果存在）
    if (this.renderInstance) {
      try {
        // React/Preact: 尝试从实例获取状态
        if (this.renderInstance.instance) {
          const instance = this.renderInstance.instance;
          // 如果是 React Root，尝试获取内部状态
          if (instance._internalRoot || instance._internalContainer) {
            state.componentState = "preserved"; // 标记为已保存
          }
        }
      } catch (_error) {
        // 忽略错误，状态保存是可选的
      }
    }

    return state;
  }

  /**
   * 恢复组件状态
   *
   * 恢复之前保存的状态
   *
   * @param savedState 保存的状态对象
   */
  private restoreComponentState(savedState: Record<string, unknown>): void {
    if (!savedState) {
      return;
    }

    // 使用 requestAnimationFrame 确保 DOM 已更新
    (globalThis as any).requestAnimationFrame(() => {
      // 1. 恢复滚动位置
      if (
        typeof savedState.scrollX === "number" &&
        typeof savedState.scrollY === "number"
      ) {
        (globalThis as any).window?.scrollTo(
          savedState.scrollX,
          savedState.scrollY,
        );
      }

      // 2. 恢复表单输入值
      if (savedState.formData && typeof savedState.formData === "object") {
        const formData = savedState.formData as Record<string, unknown>;
        const inputs = (globalThis as any).document?.querySelectorAll(
          "input, textarea, select",
        ) || [];
        for (const input of inputs) {
          const name = input.name || input.id;
          if (name && formData[name] !== undefined) {
            if (input.type === "checkbox" || input.type === "radio") {
              input.checked = Boolean(formData[name]);
            } else {
              input.value = String(formData[name]);
            }
          }
        }
      }

      // 3. 组件实例状态由框架自己处理（React Fast Refresh、Vue HMR 等）
      // 这里只处理 DOM 级别的状态
    });
  }

  /**
   * 获取 renderCSR 函数
   *
   * 优先尝试动态导入 @dreamer/render，如果失败则从全局变量获取
   *
   * @returns renderCSR 函数，如果都不可用则返回 null
   */
  private async getRenderCSR(): Promise<RenderCSRType | null> {
    // 方法1：尝试动态导入 @dreamer/render（如果应用已加载）
    try {
      // 注意：在浏览器环境中，JSR 包需要通过构建工具打包
      // 这里尝试从可能的全局模块注册表中获取
      const renderModule = await (globalThis as any).import?.(
        "@dreamer/render",
      );
      if (renderModule?.renderCSR) {
        return renderModule.renderCSR as RenderCSRType;
      }
    } catch {
      // 动态导入失败，继续尝试其他方法
    }

    // 方法2：从全局变量获取（应用运行时注册）
    if (typeof (globalThis as any).__RENDER_CSR__ !== "undefined") {
      return (globalThis as any).__RENDER_CSR__ as RenderCSRType;
    }

    // 都不可用
    return null;
  }

  /**
   * 备份模块
   *
   * 在更新前备份当前模块，以便失败时回滚
   *
   * @param moduleId 模块 ID（文件路径）
   */
  private backupModule(moduleId: string): void {
    try {
      // 尝试从模块缓存中获取当前模块
      // 注意：浏览器环境可能无法直接访问模块缓存，这里使用简化实现
      // 实际实现可能需要框架特定的 API（如 React Fast Refresh、Vue HMR）
      const moduleCache = (globalThis as any).__MODULE_CACHE__;
      if (moduleCache && moduleCache[moduleId]) {
        this.moduleBackups.set(moduleId, moduleCache[moduleId]);
      }
    } catch (_error) {
      // 备份失败不影响更新流程
      console.warn(`[HMR] 备份模块失败 ${moduleId}`);
    }
  }

  /**
   * 回滚模块
   *
   * 当更新失败时，恢复到之前的版本
   *
   * @param moduleId 模块 ID（文件路径）
   */
  private async rollbackModule(moduleId: string): Promise<void> {
    const backup = this.moduleBackups.get(moduleId);
    if (!backup) {
      console.warn(`[HMR] 未找到模块备份 ${moduleId}，无法回滚`);
      return;
    }

    try {
      // 尝试恢复模块
      // 注意：实际实现可能需要框架特定的 API
      const moduleCache = (globalThis as any).__MODULE_CACHE__;
      if (moduleCache) {
        moduleCache[moduleId] = backup;
        console.log(`[HMR] 已回滚模块: ${moduleId}`);
      } else {
        // 如果没有模块缓存，尝试重新加载原始模块（移除时间戳）
        const originalUrl = moduleId.split("?")[0];
        await (globalThis as any).import(originalUrl);
        console.log(`[HMR] 已通过重新加载回滚模块: ${moduleId}`);
      }
    } catch (error) {
      console.error(`[HMR] 回滚模块失败 ${moduleId}:`, error);
      // 回滚失败，显示错误但不强制刷新
      this.showErrorNotification(
        `模块回滚失败: ${moduleId}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * 记录更新历史
   *
   * @param moduleId 模块 ID
   * @param success 是否成功
   */
  private recordUpdate(moduleId: string, success: boolean): void {
    this.updateHistory.push({
      moduleId,
      timestamp: Date.now(),
      success,
    });

    // 只保留最近 100 条记录
    if (this.updateHistory.length > 100) {
      this.updateHistory.shift();
    }
  }

  /**
   * 显示错误通知
   *
   * 在页面上显示一个非阻塞的错误提示
   *
   * @param title 错误标题
   * @param message 错误消息
   */
  private showErrorNotification(title: string, message: string): void {
    // 创建错误通知元素
    const notification = (globalThis as any).document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fee;
      border: 1px solid #fcc;
      border-radius: 4px;
      padding: 12px 16px;
      max-width: 400px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
    `;

    notification.innerHTML = `
      <div style="font-weight: bold; color: #c33; margin-bottom: 4px;">
        ${title}
      </div>
      <div style="color: #666; font-size: 12px;">
        ${message}
      </div>
      <button type="button" style="
        margin-top: 8px;
        padding: 4px 8px;
        background: #fcc;
        border: 1px solid #c33;
        border-radius: 2px;
        cursor: pointer;
        font-size: 12px;
      ">关闭</button>
    `;

    // 添加关闭按钮事件
    const closeButton = notification.querySelector("button");
    if (closeButton) {
      closeButton.onclick = () => {
        notification.remove();
      };
    }

    // 添加到页面
    (globalThis as any).document.body.appendChild(notification);

    // 5 秒后自动关闭
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }

  /**
   * 处理模块更新
   *
   * @param message HMR 消息
   */
  private handleModuleUpdate(message: HMRMessage): void {
    // 显示更新进度
    if (message.path || message.moduleId) {
      this.statusUI.showProgress(message.path || message.moduleId || "");
    }

    // 尝试动态加载更新的模块
    if (message.files && message.files.length > 0) {
      this.loadUpdatedModules(message.files)
        .then(() => {
          // 记录成功更新
          this.statusUI.recordUpdate(true);
          // 隐藏进度
          setTimeout(() => {
            this.statusUI.hideProgress();
          }, 300);
        })
        .catch((error) => {
          console.error("[HMR] 加载更新模块失败:", error);
          // 记录失败
          this.statusUI.recordUpdate(false);
          // 隐藏进度
          this.statusUI.hideProgress();
          // 加载失败，刷新页面
          globalThis.location.reload();
        });
      return;
    }

    // 如果没有文件信息，触发模块更新事件
    const event = new CustomEvent("hmr:module-update", {
      detail: {
        moduleId: message.moduleId,
        path: message.path,
      },
    });
    globalThis.dispatchEvent(event);

    // 如果应用框架没有监听这个事件，等待一段时间后刷新页面
    setTimeout(() => {
      if (!event.defaultPrevented) {
        console.log("[HMR] 应用未处理模块更新事件，刷新页面");
        globalThis.location.reload();
      }
    }, 100);
  }
}

// 自动初始化
// 注意：wsUrl 会在编译后通过字符串替换注入
const wsUrl = ""; // 占位符，会被替换为实际的 WebSocket URL

(function initHMR() {
  if (!wsUrl) {
    console.error("[HMR] 未找到 WebSocket URL 配置");
    return;
  }

  const client = new HMRClient(wsUrl);

  // 页面加载完成后连接
  if ((globalThis as any).document.readyState === "loading") {
    (globalThis as any).document.addEventListener(
      "DOMContentLoaded",
      () => client.connect(),
    );
  } else {
    client.connect();
  }
})();
