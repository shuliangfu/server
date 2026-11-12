/**
 * HMR 更新分类与客户端应用策略
 *
 * 将「什么文件会整页刷新 / 什么走无感更新」集中在一处，供服务端广播
 * 与客户端处理共用，并便于单测。
 */

const CONFIG_PATTERNS: RegExp[] = [
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

export interface HmrRouteInferrer {
  isLayoutFile(filePath: string): boolean;
  isPageFile(filePath: string): boolean;
  isComponentFile(filePath: string): boolean;
}

/** 配置文件变化需要整页重载（构建图/工具链已变） */
export function isHmrConfigFile(filePath: string): boolean {
  return CONFIG_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * 根据变更文件确定 HMR 更新类型
 */
export function determineHmrUpdateType(
  filePath: string,
  inferrer?: HmrRouteInferrer,
): string {
  if (isHmrConfigFile(filePath)) {
    return "config-update";
  }
  if (filePath.endsWith(".css")) {
    return "css-update";
  }
  if (inferrer?.isLayoutFile(filePath)) {
    return "layout-update";
  }
  if (inferrer?.isPageFile(filePath) || inferrer?.isComponentFile(filePath)) {
    return "component-update";
  }
  if (/\.(ts|js|mjs|tsx|jsx)$/.test(filePath)) {
    return "module-update";
  }
  return "update";
}

/** 广播给浏览器的消息类型：配置变更统一为 reload */
export function hmrBroadcastType(updateType: string): string {
  return updateType === "config-update" ? "reload" : updateType;
}

export type HmrClientApplyMode = "reload" | "css" | "seamless";

/**
 * 浏览器收到消息后应如何应用：
 * - reload：整页刷新（配置变更、显式 reload、构建错误只提示）
 * - css：优先原地换样式；对不上已托管样式时再走无感刷新
 * - seamless：调用应用注册的 __HMR_REFRESH__，避免 location.reload
 */
export function hmrClientApplyMode(messageType: string): HmrClientApplyMode {
  if (
    messageType === "reload" ||
    messageType === "error" ||
    messageType === "config-update"
  ) {
    return "reload";
  }
  if (messageType === "css-update") {
    return "css";
  }
  return "seamless";
}

/**
 * 注入到 HMR 客户端的 WebSocket URL 表达式。
 * 运行时用当前页面的 protocol/host，不写死监听地址。
 */
export function hmrWebSocketUrlExpression(hmrPath: string): string {
  return `(location.protocol === "https:" ? "wss:" : "ws:") + "//" + location.host + ${
    JSON.stringify(hmrPath)
  }`;
}
