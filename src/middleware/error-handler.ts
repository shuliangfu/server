/**
 * 错误处理中间件
 *
 * 统一错误处理、错误响应格式化、错误日志记录
 */

import type { Logger } from "@dreamer/logger";
import { createLogger } from "@dreamer/logger";
import type { ErrorMiddleware } from "@dreamer/middleware";
import type { HttpContext, HttpError } from "../context.ts";

/**
 * 错误处理配置选项
 */
export interface ErrorHandlerOptions {
  /** Logger 实例（可选，如果提供则使用，否则创建默认 logger） */
  logger?: Logger;
  /** 是否为开发模式（开发模式下自动包含详细错误信息） */
  isDev?: boolean;
  /** 是否在响应中包含错误详情（生产环境建议关闭） */
  includeDetails?: boolean;
  /** 是否提供错误修复建议（仅开发模式） */
  provideSuggestions?: boolean;
  /** 自定义错误响应格式化函数 */
  formatError?: (
    error: Error,
    ctx: HttpContext,
    isDev: boolean,
    includeDetails: boolean,
    provideSuggestions: boolean,
  ) => HttpError;
}

/**
 * 创建错误处理中间件
 *
 * @param options 错误处理配置选项
 * @returns 错误处理中间件函数
 *
 * @example
 * ```typescript
 * // 生产环境
 * app.useError(errorHandler({
 *   includeDetails: false,
 * }));
 *
 * // 开发环境
 * app.useError(errorHandler({
 *   isDev: true,
 *   provideSuggestions: true,
 * }));
 * ```
 */
export function errorHandler(
  options: ErrorHandlerOptions = {},
): ErrorMiddleware<HttpContext> {
  const {
    logger = createLogger(),
    isDev = false,
    provideSuggestions = false,
    includeDetails: explicitIncludeDetails,
    formatError = defaultFormatError,
  } = options;

  // 开发模式下自动包含详细信息
  const includeDetails = explicitIncludeDetails !== undefined
    ? explicitIncludeDetails
    : isDev;

  return async (
    ctx: HttpContext,
    error: Error,
    next: () => Promise<void>,
  ): Promise<void> => {
    // 记录错误日志（包含更多上下文信息）
    logger.error("请求处理错误:", {
      method: ctx.method,
      path: ctx.path,
      url: ctx.url.toString(),
      error: error.message,
      stack: error.stack,
      params: ctx.params,
      query: ctx.query,
      requestId: (ctx.state as any)?.requestId,
    });

    // 格式化错误响应
    const httpError = formatError(
      error,
      ctx,
      isDev,
      includeDetails,
      provideSuggestions,
    );

    // 设置错误信息到上下文
    ctx.error = httpError;

    // 创建错误响应
    const errorResponse: Record<string, unknown> = {
      error: {
        code: httpError.code || "INTERNAL_SERVER_ERROR",
        message: httpError.message,
        status: httpError.status,
        timestamp: httpError.timestamp,
      },
    };

    // 如果允许，添加错误详情
    if (includeDetails && httpError.details) {
      (errorResponse.error as Record<string, unknown>).details =
        httpError.details;
    }

    ctx.response = new Response(
      JSON.stringify(errorResponse, null, isDev ? 2 : 0),
      {
        status: httpError.status,
        headers: { "Content-Type": "application/json" },
      },
    );

    await next();
  };
}

/**
 * 默认错误格式化函数
 *
 * @param error 错误对象
 * @param ctx HTTP 上下文
 * @param isDev 是否为开发模式
 * @param includeDetails 是否包含详细信息
 * @param provideSuggestions 是否提供修复建议
 * @returns HTTP 错误对象
 */
function defaultFormatError(
  error: Error,
  ctx: HttpContext,
  isDev: boolean,
  includeDetails: boolean,
  provideSuggestions: boolean,
): HttpError {
  // 尝试从错误中提取状态码
  let status = 500;
  let code = "INTERNAL_SERVER_ERROR";

  // 检查是否是已知的 HTTP 错误
  if ((error as any).status) {
    status = (error as any).status;
  }
  if ((error as any).code) {
    code = (error as any).code;
  }

  // 构建错误详情
  const details: Record<string, unknown> = {};

  if (includeDetails) {
    // 错误堆栈
    if (error.stack) {
      details.stack = error.stack;
    }

    // 开发模式下添加更多上下文信息
    if (isDev) {
      details.context = {
        method: ctx.method,
        path: ctx.path,
        url: ctx.url.toString(),
        params: ctx.params || {},
        query: ctx.query || {},
        headers: Object.fromEntries(ctx.headers.entries()),
        requestId: (ctx.state as any)?.requestId,
      };

      // 提供修复建议
      if (provideSuggestions) {
        details.suggestions = generateErrorSuggestions(error, ctx);
      }
    }
  }

  return {
    status,
    message: error.message || "Internal Server Error",
    code,
    timestamp: new Date().toISOString(),
    details: includeDetails && Object.keys(details).length > 0
      ? details
      : undefined,
  };
}

/**
 * 生成错误修复建议
 *
 * @param error 错误对象
 * @param ctx HTTP 上下文
 * @returns 修复建议数组
 */
function generateErrorSuggestions(
  error: Error,
  ctx: HttpContext,
): string[] {
  const suggestions: string[] = [];
  const errorMessage = error.message.toLowerCase();
  const errorStack = error.stack || "";

  // 常见错误建议
  if (
    errorMessage.includes("cannot read") || errorMessage.includes("undefined")
  ) {
    suggestions.push("检查变量是否已正确初始化");
    suggestions.push("使用可选链操作符 (?.) 或空值合并操作符 (??)");
  }

  if (errorMessage.includes("not found") || errorMessage.includes("404")) {
    suggestions.push(`检查路径 "${ctx.path}" 是否正确`);
    suggestions.push("确认路由是否已正确注册");
  }

  if (errorMessage.includes("permission") || errorMessage.includes("access")) {
    suggestions.push("检查文件/目录权限");
    suggestions.push("确认用户是否有足够的访问权限");
  }

  if (errorMessage.includes("timeout")) {
    suggestions.push("增加请求超时时间");
    suggestions.push("检查网络连接或服务器响应速度");
  }

  if (errorStack.includes("async") || errorStack.includes("await")) {
    suggestions.push("检查异步函数是否正确使用 await");
    suggestions.push("确认 Promise 是否被正确处理");
  }

  if (errorMessage.includes("json") || errorMessage.includes("parse")) {
    suggestions.push("检查请求体格式是否正确");
    suggestions.push("确认 Content-Type 头是否匹配");
  }

  // 如果没有特定建议，提供通用建议
  if (suggestions.length === 0) {
    suggestions.push("查看错误堆栈以定位问题");
    suggestions.push("检查相关代码逻辑");
    suggestions.push("确认依赖是否正确安装");
  }

  return suggestions;
}
