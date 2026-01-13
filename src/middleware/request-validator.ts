/**
 * 请求验证中间件
 *
 * 提供请求大小限制、参数验证等功能
 */

import type { Middleware } from "@dreamer/middleware";
import type { HttpContext } from "../context.ts";

/**
 * 验证规则接口
 */
export interface ValidationRule {
  /** 字段名称 */
  field: string;
  /** 验证函数 */
  validate: (value: unknown) => boolean | string;
  /** 错误消息（如果验证函数返回 false） */
  message?: string;
  /** 是否必需（默认：false） */
  required?: boolean;
}

/**
 * 请求验证配置选项
 */
export interface RequestValidatorOptions {
  /** 请求体大小限制（字节，默认：1MB） */
  maxBodySize?: number;
  /** 请求头大小限制（字节，默认：8KB） */
  maxHeaderSize?: number;
  /** URL 长度限制（默认：2048） */
  maxUrlLength?: number;
  /** 查询参数数量限制（默认：100） */
  maxQueryParams?: number;
  /** 验证规则（基于字段的验证） */
  rules?: ValidationRule[];
  /** 自定义验证函数 */
  validate?: (ctx: HttpContext) => boolean | string | Promise<boolean | string>;
  /** 错误消息格式化函数 */
  formatError?: (field: string, message: string) => string;
  /** 判断是否应该跳过验证的函数 */
  shouldSkip?: (ctx: HttpContext) => boolean;
}

/**
 * 默认错误消息格式化函数
 *
 * @param field 字段名称
 * @param message 错误消息
 * @returns 格式化后的错误消息
 */
function defaultFormatError(field: string, message: string): string {
  return `${field}: ${message}`;
}

/**
 * 验证请求大小
 *
 * @param ctx HTTP 上下文
 * @param options 验证选项
 * @returns 错误消息，如果验证通过返回 null
 */
function validateRequestSize(
  ctx: HttpContext,
  options: RequestValidatorOptions,
): string | null {
  const {
    maxBodySize = 1024 * 1024, // 1MB
    maxHeaderSize = 8 * 1024, // 8KB
    maxUrlLength = 2048,
    maxQueryParams = 100,
  } = options;

  // 验证 URL 长度
  if (ctx.url.toString().length > maxUrlLength) {
    return `URL too long (max: ${maxUrlLength} characters)`;
  }

  // 验证查询参数数量
  if (ctx.query && Object.keys(ctx.query).length > maxQueryParams) {
    return `Too many query parameters (max: ${maxQueryParams})`;
  }

  // 验证请求头大小
  let headerSize = 0;
  for (const [key, value] of ctx.headers.entries()) {
    headerSize += key.length + value.length + 4; // 4 for ": " and "\r\n"
  }
  if (headerSize > maxHeaderSize) {
    return `Request headers too large (max: ${maxHeaderSize} bytes)`;
  }

  // 验证请求体大小（如果 body 是字符串或 Uint8Array）
  if (ctx.body) {
    if (typeof ctx.body === "string") {
      const bodySize = new TextEncoder().encode(ctx.body).length;
      if (bodySize > maxBodySize) {
        return `Request body too large (max: ${maxBodySize} bytes)`;
      }
    } else if (ctx.body instanceof Uint8Array) {
      if (ctx.body.length > maxBodySize) {
        return `Request body too large (max: ${maxBodySize} bytes)`;
      }
    } else if (typeof ctx.body === "object") {
      // 对于对象，估算 JSON 序列化后的大小
      try {
        const jsonString = JSON.stringify(ctx.body);
        const bodySize = new TextEncoder().encode(jsonString).length;
        if (bodySize > maxBodySize) {
          return `Request body too large (max: ${maxBodySize} bytes)`;
        }
      } catch {
        // 如果序列化失败，跳过大小检查
      }
    }
  }

  return null;
}

/**
 * 验证字段规则
 *
 * @param ctx HTTP 上下文
 * @param rules 验证规则
 * @param formatError 错误格式化函数
 * @returns 错误消息，如果验证通过返回 null
 */
function validateRules(
  ctx: HttpContext,
  rules: ValidationRule[],
  formatError: (field: string, message: string) => string,
): string | null {
  // 合并查询参数和请求体
  const data: Record<string, unknown> = {
    ...(ctx.query || {}),
    ...(ctx.body && typeof ctx.body === "object"
      ? ctx.body as Record<string, unknown>
      : {}),
  };

  for (const rule of rules) {
    const value = data[rule.field];
    const isRequired = rule.required !== false;

    // 检查必需字段
    if (isRequired && (value === undefined || value === null || value === "")) {
      return formatError(
        rule.field,
        rule.message || "This field is required",
      );
    }

    // 如果字段存在，进行验证
    if (value !== undefined && value !== null && value !== "") {
      const result = rule.validate(value);
      if (result === false) {
        return formatError(
          rule.field,
          rule.message || "Validation failed",
        );
      } else if (typeof result === "string") {
        return formatError(rule.field, result);
      }
    }
  }

  return null;
}

/**
 * 创建请求验证中间件
 *
 * @param options 请求验证配置选项
 * @returns 请求验证中间件函数
 *
 * @example
 * ```typescript
 * app.use(requestValidator({
 *   maxBodySize: 1024 * 1024, // 1MB
 *   rules: [
 *     {
 *       field: "email",
 *       required: true,
 *       validate: (value) => typeof value === "string" && value.includes("@"),
 *       message: "Invalid email format",
 *     },
 *   ],
 * }));
 * ```
 */
export function requestValidator(
  options: RequestValidatorOptions = {},
): Middleware<HttpContext> {
  const {
    rules = [],
    validate: customValidate,
    formatError = defaultFormatError,
    shouldSkip,
  } = options;

  return async (ctx: HttpContext, next: () => Promise<void>): Promise<void> => {
    // 如果应该跳过，直接执行下一个中间件
    if (shouldSkip && shouldSkip(ctx)) {
      await next();
      return;
    }

    // 验证请求大小
    const sizeError = validateRequestSize(ctx, options);
    if (sizeError) {
      ctx.response = new Response(
        JSON.stringify({
          error: {
            code: "REQUEST_TOO_LARGE",
            message: sizeError,
            status: 413,
          },
        }),
        {
          status: 413,
          headers: { "Content-Type": "application/json" },
        },
      );
      return;
    }

    // 验证字段规则
    if (rules.length > 0) {
      const ruleError = validateRules(ctx, rules, formatError);
      if (ruleError) {
        ctx.response = new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message: ruleError,
              status: 400,
            },
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
        return;
      }
    }

    // 自定义验证
    if (customValidate) {
      const customResult = await customValidate(ctx);
      if (customResult === false) {
        ctx.response = new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message: "Validation failed",
              status: 400,
            },
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
        return;
      } else if (typeof customResult === "string") {
        ctx.response = new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message: customResult,
              status: 400,
            },
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
        return;
      }
    }

    // 验证通过，继续执行下一个中间件
    await next();
  };
}
