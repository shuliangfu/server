/**
 * 路由推断工具
 *
 * 从文件路径推断对应的路由路径，支持多种文件结构和动态路由
 */

/**
 * 路由映射配置
 */
export interface RouteMapping {
  // 文件路径模式 -> 路由路径模板
  patterns: Array<{
    filePattern: RegExp;
    routeTemplate: string;
  }>;
  // 基础路径（用于相对路径解析）
  basePath?: string;
}

/**
 * 默认路由映射规则
 */
const DEFAULT_ROUTE_PATTERNS: RouteMapping["patterns"] = [
  // Pages 目录结构（Next.js 风格）
  {
    filePattern: /pages\/(.*)\.(tsx?|jsx?)$/i,
    routeTemplate: "/$1",
  },
  // Routes 目录结构（Remix 风格）
  {
    filePattern: /routes\/(.*)\.(tsx?|jsx?)$/i,
    routeTemplate: "/$1",
  },
  // App 目录结构（Next.js 13+ App Router 风格）
  {
    filePattern: /app\/(.*)\/page\.(tsx?|jsx?)$/i,
    routeTemplate: "/$1",
  },
  {
    filePattern: /app\/(.*)\/layout\.(tsx?|jsx?)$/i,
    routeTemplate: "/$1",
  },
  // 通用组件目录（作为备用）
  {
    filePattern: /(?:components?|pages?|routes?)\/(.*)\.(tsx?|jsx?)$/i,
    routeTemplate: "/$1",
  },
];

/**
 * 路由推断器
 */
export class RouteInferrer {
  private mapping: RouteMapping;

  constructor(mapping?: Partial<RouteMapping>) {
    this.mapping = {
      patterns: mapping?.patterns || DEFAULT_ROUTE_PATTERNS,
      basePath: mapping?.basePath || "",
    };
  }

  /**
   * 从文件路径推断路由路径
   *
   * @param filePath 文件路径
   * @returns 推断的路由路径，如果无法推断则返回 undefined
   */
  inferRoute(filePath: string): string | undefined {
    // 规范化文件路径（移除基础路径）
    const normalizedPath = this.normalizePath(filePath);

    // 尝试匹配每个模式
    for (const pattern of this.mapping.patterns) {
      const match = normalizedPath.match(pattern.filePattern);
      if (match) {
        // 提取匹配的路径部分
        const pathPart = match[1] || "";

        // 应用路由模板
        let route = pattern.routeTemplate.replace(/\$1/g, pathPart);

        // 处理动态路由参数
        route = this.processDynamicRoute(route);

        // 规范化路由路径
        route = this.normalizeRoute(route);

        return route;
      }
    }

    // 如果都不匹配，返回 undefined
    return undefined;
  }

  /**
   * 规范化文件路径
   *
   * @param filePath 文件路径
   * @returns 规范化后的路径
   */
  private normalizePath(filePath: string): string {
    // 移除基础路径
    let normalized = filePath;
    if (this.mapping.basePath) {
      normalized = normalized.replace(this.mapping.basePath, "");
    }

    // 统一使用正斜杠
    normalized = normalized.replace(/\\/g, "/");

    // 移除开头的斜杠
    normalized = normalized.replace(/^\//, "");

    return normalized;
  }

  /**
   * 处理动态路由参数
   *
   * 将文件路径中的动态路由语法转换为标准路由语法：
   * - `[id]` -> `:id`
   * - `[...slug]` -> `*`
   * - `(group)` -> 移除（Next.js 路由组）
   *
   * @param route 路由路径
   * @returns 处理后的路由路径
   */
  private processDynamicRoute(route: string): string {
    // 处理 Next.js 路由组 `(group)` - 移除但不影响路由
    route = route.replace(/\([^)]+\)\//g, "");

    // 先处理可选捕获路由 `[[...slug]]` -> `*`（必须在 [...slug] 之前）
    route = route.replace(/\[\[\.\.\.(\w+)\]\]/g, "*");

    // 处理可选参数 `[[id]]` -> `:id?`（必须在 [id] 之前）
    route = route.replace(/\[\[(\w+)\]\]/g, ":$1?");

    // 处理捕获所有路由 `[...slug]` -> `*`
    route = route.replace(/\[\.\.\.(\w+)\]/g, "*");

    // 处理动态路由参数 `[id]` -> `:id`
    route = route.replace(/\[(\w+)\]/g, ":$1");

    return route;
  }

  /**
   * 规范化路由路径
   *
   * @param route 路由路径
   * @returns 规范化后的路由路径
   */
  private normalizeRoute(route: string): string {
    // 移除 index 路由（`/index` -> `/`）
    route = route.replace(/\/index$/i, "/");

    // 确保以 / 开头
    if (!route.startsWith("/")) {
      route = `/${route}`;
    }

    // 移除尾随斜杠（除非是根路径）
    if (route !== "/" && route.endsWith("/")) {
      route = route.slice(0, -1);
    }

    // 移除重复的斜杠
    route = route.replace(/\/+/g, "/");

    return route;
  }

  /**
   * 检查文件是否是布局文件
   *
   * @param filePath 文件路径
   * @returns 是否是布局文件
   */
  isLayoutFile(filePath: string): boolean {
    const normalizedPath = this.normalizePath(filePath);
    return (
      /layout\.(tsx?|jsx?)$/i.test(normalizedPath) ||
      /_layout\.(tsx?|jsx?)$/i.test(normalizedPath) ||
      /app\/.*\/layout\.(tsx?|jsx?)$/i.test(normalizedPath)
    );
  }

  /**
   * 检查文件是否是页面文件
   *
   * @param filePath 文件路径
   * @returns 是否是页面文件
   */
  isPageFile(filePath: string): boolean {
    const normalizedPath = this.normalizePath(filePath);
    return (
      /page\.(tsx?|jsx?)$/i.test(normalizedPath) ||
      /(?:pages?|routes?)\/.*\.(tsx?|jsx?)$/i.test(normalizedPath) &&
        !this.isLayoutFile(filePath)
    );
  }

  /**
   * 检查文件是否是组件文件
   *
   * @param filePath 文件路径
   * @returns 是否是组件文件
   */
  isComponentFile(filePath: string): boolean {
    const normalizedPath = this.normalizePath(filePath);
    return (
      /components?\/.*\.(tsx?|jsx?)$/i.test(normalizedPath) &&
      !this.isLayoutFile(filePath) &&
      !this.isPageFile(filePath)
    );
  }
}

/**
 * 创建默认路由推断器
 *
 * @param mapping 可选的映射配置
 * @returns 路由推断器实例
 */
export function createRouteInferrer(
  mapping?: Partial<RouteMapping>,
): RouteInferrer {
  return new RouteInferrer(mapping);
}
