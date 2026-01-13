/**
 * 安全头中间件
 *
 * 设置 HTTP 安全响应头，提高应用安全性
 */

import type { Middleware } from "@dreamer/middleware";
import type { HttpContext } from "../context.ts";

/**
 * 动态安全策略函数
 * 根据请求上下文动态决定安全头配置
 */
export type DynamicSecurityPolicy = (
  ctx: HttpContext,
) => Partial<SecurityHeadersOptions> | Promise<Partial<SecurityHeadersOptions>>;

/**
 * 安全头配置选项
 */
export interface SecurityHeadersOptions {
  /** 是否启用 X-Frame-Options（默认：true） */
  frameOptions?: boolean | "DENY" | "SAMEORIGIN";
  /** 是否启用 X-Content-Type-Options（默认：true） */
  contentTypeOptions?: boolean;
  /** 是否启用 X-XSS-Protection（默认：true） */
  xssProtection?: boolean | "0" | "1" | "1; mode=block";
  /** 是否启用 Referrer-Policy（默认：true） */
  referrerPolicy?: boolean | string;
  /** 是否启用 Content-Security-Policy（默认：false） */
  contentSecurityPolicy?: boolean | string;
  /** 是否启用 Strict-Transport-Security（默认：false，仅 HTTPS） */
  strictTransportSecurity?: boolean | string;
  /** 是否启用 Permissions-Policy（默认：false） */
  permissionsPolicy?: boolean | string;
  /** 是否启用 Cross-Origin-Embedder-Policy（默认：false） */
  crossOriginEmbedderPolicy?: boolean | "require-corp" | "credentialless";
  /** 是否启用 Cross-Origin-Opener-Policy（默认：false） */
  crossOriginOpenerPolicy?:
    | boolean
    | "same-origin"
    | "same-origin-allow-popups"
    | "unsafe-none";
  /** 是否启用 Cross-Origin-Resource-Policy（默认：false） */
  crossOriginResourcePolicy?:
    | boolean
    | "same-origin"
    | "same-site"
    | "cross-origin";
  /** 是否启用 X-DNS-Prefetch-Control（默认：false） */
  dnsPrefetchControl?: boolean | "on" | "off";
  /** 是否启用 X-Download-Options（默认：false，仅 IE） */
  downloadOptions?: boolean;
  /** 是否启用 X-Permitted-Cross-Domain-Policies（默认：false） */
  permittedCrossDomainPolicies?:
    | boolean
    | "none"
    | "master-only"
    | "by-content-type"
    | "all";
  /** 动态安全策略函数（根据请求动态调整安全头） */
  dynamicPolicy?: DynamicSecurityPolicy;
  /** 是否验证安全头配置（默认：false） */
  validateConfig?: boolean;
}

/**
 * 验证安全头配置
 *
 * @param options 安全头配置选项
 * @throws 如果配置无效
 */
function validateSecurityHeadersConfig(
  options: SecurityHeadersOptions,
): void {
  // 验证 CSP 配置（如果启用）
  if (
    options.contentSecurityPolicy &&
    typeof options.contentSecurityPolicy === "string"
  ) {
    // 基本验证：检查是否包含必要的指令
    const csp = options.contentSecurityPolicy.toLowerCase();
    if (!csp.includes("default-src") && !csp.includes("script-src")) {
      console.warn(
        "[安全头警告] Content-Security-Policy 建议包含 default-src 或 script-src 指令",
      );
    }
  }

  // 验证 COEP 和 COOP 的组合
  if (
    options.crossOriginEmbedderPolicy &&
    options.crossOriginOpenerPolicy !== "same-origin"
  ) {
    console.warn(
      "[安全头警告] Cross-Origin-Embedder-Policy 建议与 Cross-Origin-Opener-Policy: same-origin 一起使用",
    );
  }
}

/**
 * 创建安全头中间件
 *
 * @param options 安全头配置选项
 * @returns 安全头中间件函数
 *
 * @example
 * ```typescript
 * import { securityHeaders } from "@dreamer/server";
 *
 * // 使用默认配置
 * app.use(securityHeaders());
 *
 * // 自定义配置
 * app.use(securityHeaders({
 *   frameOptions: "SAMEORIGIN",
 *   contentSecurityPolicy: "default-src 'self'",
 *   crossOriginEmbedderPolicy: "require-corp",
 * }));
 *
 * // 动态安全策略
 * app.use(securityHeaders({
 *   dynamicPolicy: (ctx) => {
 *     if (ctx.path.startsWith("/api")) {
 *       return { contentSecurityPolicy: false };
 *     }
 *     return {};
 *   },
 * }));
 * ```
 */
export function securityHeaders(
  options: SecurityHeadersOptions = {},
): Middleware<HttpContext> {
  // 验证配置（如果启用）
  if (options.validateConfig) {
    validateSecurityHeadersConfig(options);
  }

  const { dynamicPolicy } = options;

  return async (ctx: HttpContext, next: () => Promise<void>): Promise<void> => {
    // 先执行下一个中间件
    await next();

    // 如果没有响应，直接返回
    if (!ctx.response) {
      return;
    }

    // 应用动态安全策略（如果提供）
    let finalOptions: SecurityHeadersOptions = options;
    if (dynamicPolicy) {
      const dynamicConfig = await dynamicPolicy(ctx);
      finalOptions = { ...options, ...dynamicConfig };
    }

    // 创建新的响应头
    const headers = new Headers(ctx.response.headers);

    // X-Frame-Options（默认：true）
    const frameOptions = finalOptions.frameOptions ?? true;
    if (frameOptions) {
      const value = frameOptions === true ? "DENY" : frameOptions;
      headers.set("X-Frame-Options", value);
    }

    // X-Content-Type-Options（默认：true）
    const contentTypeOptions = finalOptions.contentTypeOptions ?? true;
    if (contentTypeOptions) {
      headers.set("X-Content-Type-Options", "nosniff");
    }

    // X-XSS-Protection（默认：true）
    const xssProtection = finalOptions.xssProtection ?? true;
    if (xssProtection) {
      const value = xssProtection === true ? "1; mode=block" : xssProtection;
      headers.set("X-XSS-Protection", value);
    }

    // Referrer-Policy（默认：true）
    const referrerPolicy = finalOptions.referrerPolicy ?? true;
    if (referrerPolicy) {
      const value = referrerPolicy === true
        ? "strict-origin-when-cross-origin"
        : referrerPolicy;
      headers.set("Referrer-Policy", value);
    }

    // Content-Security-Policy（默认：false）
    const contentSecurityPolicy = finalOptions.contentSecurityPolicy ?? false;
    if (contentSecurityPolicy) {
      const value = contentSecurityPolicy === true
        ? "default-src 'self'"
        : contentSecurityPolicy;
      headers.set("Content-Security-Policy", value);
    }

    // Strict-Transport-Security（默认：false，仅 HTTPS）
    const strictTransportSecurity = finalOptions.strictTransportSecurity ??
      false;
    if (strictTransportSecurity && ctx.url.protocol === "https:") {
      const value = strictTransportSecurity === true
        ? "max-age=31536000; includeSubDomains"
        : strictTransportSecurity;
      headers.set("Strict-Transport-Security", value);
    }

    // Permissions-Policy（默认：false）
    const permissionsPolicy = finalOptions.permissionsPolicy ?? false;
    if (permissionsPolicy) {
      const value = permissionsPolicy === true
        ? "geolocation=(), microphone=(), camera=()"
        : permissionsPolicy;
      headers.set("Permissions-Policy", value);
    }

    // Cross-Origin-Embedder-Policy（默认：false）
    const crossOriginEmbedderPolicy = finalOptions.crossOriginEmbedderPolicy ??
      false;
    if (crossOriginEmbedderPolicy) {
      const value = crossOriginEmbedderPolicy === true
        ? "require-corp"
        : crossOriginEmbedderPolicy;
      headers.set("Cross-Origin-Embedder-Policy", value);
    }

    // Cross-Origin-Opener-Policy（默认：false）
    const crossOriginOpenerPolicy = finalOptions.crossOriginOpenerPolicy ??
      false;
    if (crossOriginOpenerPolicy) {
      const value = crossOriginOpenerPolicy === true
        ? "same-origin"
        : crossOriginOpenerPolicy;
      headers.set("Cross-Origin-Opener-Policy", value);
    }

    // Cross-Origin-Resource-Policy（默认：false）
    const crossOriginResourcePolicy = finalOptions.crossOriginResourcePolicy ??
      false;
    if (crossOriginResourcePolicy) {
      const value = crossOriginResourcePolicy === true
        ? "same-origin"
        : crossOriginResourcePolicy;
      headers.set("Cross-Origin-Resource-Policy", value);
    }

    // X-DNS-Prefetch-Control（默认：false）
    const dnsPrefetchControl = finalOptions.dnsPrefetchControl ?? false;
    if (dnsPrefetchControl) {
      const value = dnsPrefetchControl === true ? "on" : dnsPrefetchControl;
      headers.set("X-DNS-Prefetch-Control", value);
    }

    // X-Download-Options（默认：false）
    const downloadOptions = finalOptions.downloadOptions ?? false;
    if (downloadOptions) {
      headers.set("X-Download-Options", "noopen");
    }

    // X-Permitted-Cross-Domain-Policies（默认：false）
    const permittedCrossDomainPolicies =
      finalOptions.permittedCrossDomainPolicies ?? false;
    if (permittedCrossDomainPolicies) {
      const value = permittedCrossDomainPolicies === true
        ? "none"
        : permittedCrossDomainPolicies;
      headers.set("X-Permitted-Cross-Domain-Policies", value);
    }

    // 更新响应
    ctx.response = new Response(ctx.response.body, {
      status: ctx.response.status,
      statusText: ctx.response.statusText,
      headers,
    });
  };
}
