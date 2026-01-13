/**
 * 请求签名验证中间件
 *
 * 使用 HMAC 签名验证请求，防止请求篡改
 */

import type { Middleware } from "@dreamer/middleware";
import type { HttpContext } from "../context.ts";

/**
 * HMAC 签名算法类型
 */
export type HmacAlgorithm = "HS256" | "HS384" | "HS512";

/**
 * 请求签名配置选项
 */
export interface RequestSignatureOptions {
  /** 密钥（字符串或 CryptoKey） */
  secret: string | CryptoKey;
  /** HMAC 算法（默认：HS256） */
  algorithm?: HmacAlgorithm;
  /** 签名请求头名称（默认：X-Request-Signature） */
  signatureHeader?: string;
  /** 时间戳请求头名称（默认：X-Request-Timestamp） */
  timestampHeader?: string;
  /** 签名过期时间（秒，默认：300，5 分钟） */
  expiresIn?: number;
  /** 时间戳容差（秒，默认：60，允许 1 分钟的时间差） */
  timestampTolerance?: number;
  /** 生成签名的字段（默认：包含 method、path、query、body、timestamp） */
  signFields?: (ctx: HttpContext, timestamp: number) => string;
  /** 判断是否应该跳过验证的函数 */
  shouldSkip?: (ctx: HttpContext) => boolean;
  /** 错误消息（默认：Forbidden: Invalid request signature） */
  errorMessage?: string;
}

/**
 * 默认生成签名字段
 *
 * @param ctx HTTP 上下文
 * @param timestamp 时间戳
 * @returns 签名字符串
 */
function defaultSignFields(ctx: HttpContext, timestamp: number): string {
  const parts: string[] = [
    ctx.method,
    ctx.path,
  ];

  // 包含查询参数（排序后）
  if (ctx.query && Object.keys(ctx.query).length > 0) {
    const queryString = Object.entries(ctx.query)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    parts.push(queryString);
  }

  // 包含请求体（如果存在）
  if (ctx.body) {
    if (typeof ctx.body === "string") {
      parts.push(ctx.body);
    } else {
      parts.push(JSON.stringify(ctx.body));
    }
  }

  // 包含时间戳
  parts.push(timestamp.toString());

  return parts.join("|");
}

/**
 * 生成 HMAC 签名
 *
 * @param data 要签名的数据
 * @param secret 密钥
 * @param algorithm 算法
 * @returns Base64 编码的签名
 */
async function generateHMACSignature(
  data: string,
  secret: string | CryptoKey,
  algorithm: HmacAlgorithm,
): Promise<string> {
  const crypto = globalThis.crypto;
  let key: CryptoKey;

  if (secret instanceof CryptoKey) {
    key = secret;
  } else {
    const hashAlg = algorithm === "HS256"
      ? "SHA-256"
      : algorithm === "HS384"
      ? "SHA-384"
      : "SHA-512";

    key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      {
        name: "HMAC",
        hash: hashAlg,
      },
      false,
      ["sign"],
    );
  }

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );

  // 转换为 Base64
  const bytes = new Uint8Array(signatureBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * 验证 HMAC 签名
 *
 * @param data 原始数据
 * @param signature Base64 编码的签名
 * @param secret 密钥
 * @param algorithm 算法
 * @returns 是否有效
 */
async function verifyHMACSignature(
  data: string,
  signature: string,
  secret: string | CryptoKey,
  algorithm: HmacAlgorithm,
): Promise<boolean> {
  const crypto = globalThis.crypto;
  let key: CryptoKey;

  if (secret instanceof CryptoKey) {
    key = secret;
  } else {
    const hashAlg = algorithm === "HS256"
      ? "SHA-256"
      : algorithm === "HS384"
      ? "SHA-384"
      : "SHA-512";

    key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      {
        name: "HMAC",
        hash: hashAlg,
      },
      false,
      ["verify"],
    );
  }

  // 解码 Base64 签名（处理无效字符）
  let signatureBuffer: ArrayBuffer;
  try {
    const decoded = atob(signature);
    signatureBuffer = new Uint8Array(
      Array.from(decoded, (c) => c.charCodeAt(0)),
    ).buffer;
  } catch {
    // 如果 Base64 解码失败，签名无效
    return false;
  }

  try {
    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBuffer,
      new TextEncoder().encode(data),
    );
  } catch {
    // 任何错误都表示签名无效
    return false;
  }
}

/**
 * 创建请求签名验证中间件
 *
 * @param options 配置选项
 * @returns 请求签名验证中间件函数
 *
 * @example
 * ```typescript
 * app.use(requestSignature({
 *   secret: "your-secret-key",
 *   algorithm: "HS256",
 *   expiresIn: 300,
 * }));
 * ```
 */
export function requestSignature(
  options: RequestSignatureOptions,
): Middleware<HttpContext> {
  const {
    secret,
    algorithm = "HS256",
    signatureHeader = "X-Request-Signature",
    timestampHeader = "X-Request-Timestamp",
    expiresIn = 300, // 5 分钟
    timestampTolerance = 60, // 1 分钟容差
    signFields = defaultSignFields,
    shouldSkip,
    errorMessage = "Forbidden: Invalid request signature",
  } = options;

  return async (ctx: HttpContext, next: () => Promise<void>): Promise<void> => {
    // 如果应该跳过，直接执行下一个中间件
    if (shouldSkip && shouldSkip(ctx)) {
      await next();
      return;
    }

    // 获取签名和时间戳
    const requestSignature = ctx.headers.get(signatureHeader);
    const timestampStr = ctx.headers.get(timestampHeader);

    if (!requestSignature || !timestampStr) {
      ctx.response = new Response(
        JSON.stringify({
          error: {
            code: "MISSING_SIGNATURE",
            message: "Request signature and timestamp are required",
            status: 403,
          },
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
      return;
    }

    // 解析时间戳
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      ctx.response = new Response(
        JSON.stringify({
          error: {
            code: "INVALID_TIMESTAMP",
            message: "Invalid timestamp format",
            status: 403,
          },
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
      return;
    }

    // 检查时间戳是否过期
    const now = Math.floor(Date.now() / 1000);
    const age = now - timestamp;

    if (age > expiresIn + timestampTolerance) {
      ctx.response = new Response(
        JSON.stringify({
          error: {
            code: "SIGNATURE_EXPIRED",
            message: `Request signature expired (age: ${age}s, max: ${
              expiresIn + timestampTolerance
            }s)`,
            status: 403,
          },
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
      return;
    }

    // 检查时间戳是否在未来（超过容差）
    if (timestamp > now + timestampTolerance) {
      ctx.response = new Response(
        JSON.stringify({
          error: {
            code: "INVALID_TIMESTAMP",
            message: "Request timestamp is in the future",
            status: 403,
          },
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
      return;
    }

    // 生成期望的签名
    const dataToSign = signFields(ctx, timestamp);
    const isValid = await verifyHMACSignature(
      dataToSign,
      requestSignature,
      secret,
      algorithm,
    );

    if (!isValid) {
      ctx.response = new Response(
        JSON.stringify({
          error: {
            code: "INVALID_SIGNATURE",
            message: errorMessage,
            status: 403,
          },
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
      return;
    }

    // 验证通过，继续执行下一个中间件
    await next();
  };
}

/**
 * 生成请求签名（用于客户端）
 *
 * @param method HTTP 方法
 * @param path 请求路径
 * @param query 查询参数
 * @param body 请求体
 * @param secret 密钥
 * @param algorithm 算法
 * @returns 签名和时间戳
 */
export async function generateRequestSignature(
  method: string,
  path: string,
  query: Record<string, string> = {},
  body: unknown = null,
  secret: string | CryptoKey,
  algorithm: HmacAlgorithm = "HS256",
): Promise<{ signature: string; timestamp: number }> {
  const timestamp = Math.floor(Date.now() / 1000);

  // 构建签名字段
  const parts: string[] = [method, path];

  if (Object.keys(query).length > 0) {
    const queryString = Object.entries(query)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    parts.push(queryString);
  }

  if (body) {
    if (typeof body === "string") {
      parts.push(body);
    } else {
      parts.push(JSON.stringify(body));
    }
  }

  parts.push(timestamp.toString());

  const dataToSign = parts.join("|");
  const signature = await generateHMACSignature(dataToSign, secret, algorithm);

  return { signature, timestamp };
}
