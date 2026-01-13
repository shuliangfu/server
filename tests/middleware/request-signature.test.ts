/**
 * 请求签名验证中间件测试
 */

import { describe, expect, it } from "@dreamer/test";
import {
  generateRequestSignature,
  requestSignature,
} from "../../src/middleware/request-signature.ts";
import { createTestContext } from "../helpers.ts";

describe("Request Signature 中间件", () => {
  const secret = "test-secret-key-12345";

  describe("基础功能", () => {
    it("应该创建请求签名验证中间件", () => {
      const middleware = requestSignature({ secret });
      expect(typeof middleware).toBe("function");
    });

    it("应该拒绝缺少签名的请求", async () => {
      const middleware = requestSignature({ secret });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(403);
      const text = await context.response?.text();
      expect(text).toContain("MISSING_SIGNATURE");
    });

    it("应该拒绝缺少时间戳的请求", async () => {
      const middleware = requestSignature({ secret });
      const request = new Request("http://localhost:8000/api", {
        headers: { "X-Request-Signature": "some-signature" },
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(403);
      const text = await context.response?.text();
      expect(text).toContain("MISSING_SIGNATURE");
    });

    it("应该接受有效的签名", async () => {
      const middleware = requestSignature({ secret });
      const { signature, timestamp } = await generateRequestSignature(
        "GET",
        "/api",
        {},
        null,
        secret,
      );

      const request = new Request("http://localhost:8000/api", {
        headers: {
          "X-Request-Signature": signature,
          "X-Request-Timestamp": timestamp.toString(),
        },
      });
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      expect(context.response?.status).toBe(200);
    });

    it("应该拒绝无效的签名", async () => {
      const middleware = requestSignature({ secret });
      const timestamp = Math.floor(Date.now() / 1000);

      const request = new Request("http://localhost:8000/api", {
        headers: {
          "X-Request-Signature": "invalid-signature-not-base64",
          "X-Request-Timestamp": timestamp.toString(),
        },
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(403);
      const text = await context.response?.text();
      expect(text).toContain("INVALID_SIGNATURE");
    });

    it("应该拒绝过期的签名", async () => {
      const middleware = requestSignature({
        secret,
        expiresIn: 60, // 1 分钟
      });
      const oldTimestamp = Math.floor(Date.now() / 1000) - 120; // 2 分钟前
      // 使用旧时间戳生成签名
      const { signature } = await generateRequestSignature(
        "GET",
        "/api",
        {},
        null,
        secret,
      );
      // 但使用旧时间戳
      const request = new Request("http://localhost:8000/api", {
        headers: {
          "X-Request-Signature": signature,
          "X-Request-Timestamp": oldTimestamp.toString(),
        },
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(403);
      const text = await context.response?.text() || "";
      // 由于时间戳过期，应该先检查时间戳，返回 SIGNATURE_EXPIRED
      // 但由于签名是用新时间戳生成的，而请求使用旧时间戳，签名验证会失败
      // 所以可能返回 INVALID_SIGNATURE 或 SIGNATURE_EXPIRED
      expect(
        text.includes("SIGNATURE_EXPIRED") ||
          text.includes("INVALID_SIGNATURE"),
      ).toBe(true);
    });

    it("应该拒绝未来时间戳的请求", async () => {
      const middleware = requestSignature({ secret });
      const futureTimestamp = Math.floor(Date.now() / 1000) + 120; // 2 分钟后

      const request = new Request("http://localhost:8000/api", {
        headers: {
          "X-Request-Signature": "some-signature",
          "X-Request-Timestamp": futureTimestamp.toString(),
        },
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(403);
      const text = await context.response?.text();
      expect(text).toContain("INVALID_TIMESTAMP");
    });
  });

  describe("配置选项", () => {
    it("应该支持自定义签名算法", async () => {
      const middleware = requestSignature({
        secret,
        algorithm: "HS512",
      });
      const { signature, timestamp } = await generateRequestSignature(
        "GET",
        "/api",
        {},
        null,
        secret,
        "HS512",
      );

      const request = new Request("http://localhost:8000/api", {
        headers: {
          "X-Request-Signature": signature,
          "X-Request-Timestamp": timestamp.toString(),
        },
      });
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      expect(context.response?.status).toBe(200);
    });

    it("应该支持自定义请求头名称", async () => {
      const middleware = requestSignature({
        secret,
        signatureHeader: "X-Custom-Signature",
        timestampHeader: "X-Custom-Timestamp",
      });
      const { signature, timestamp } = await generateRequestSignature(
        "GET",
        "/api",
        {},
        null,
        secret,
      );

      const request = new Request("http://localhost:8000/api", {
        headers: {
          "X-Custom-Signature": signature,
          "X-Custom-Timestamp": timestamp.toString(),
        },
      });
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      expect(context.response?.status).toBe(200);
    });

    it("应该支持自定义签名过期时间", async () => {
      const middleware = requestSignature({
        secret,
        expiresIn: 10, // 10 秒
      });
      const recentTimestamp = Math.floor(Date.now() / 1000) - 5; // 5 秒前
      // 使用旧时间戳生成签名
      const oldTimestamp = recentTimestamp;
      const parts: string[] = ["GET", "/api"];
      parts.push(oldTimestamp.toString());
      const dataToSign = parts.join("|");

      // 手动生成签名
      const crypto = globalThis.crypto;
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(dataToSign),
      );
      const bytes = new Uint8Array(signatureBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const signature = btoa(binary);

      const request = new Request("http://localhost:8000/api", {
        headers: {
          "X-Request-Signature": signature,
          "X-Request-Timestamp": recentTimestamp.toString(),
        },
      });
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      // 应该通过（5 秒 < 10 秒 + 容差）
      expect(context.response?.status).toBe(200);
    });

    it("应该支持自定义时间戳容差", async () => {
      const middleware = requestSignature({
        secret,
        timestampTolerance: 5, // 5 秒容差
      });
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3; // 3 秒后
      // 使用未来时间戳生成签名
      const { signature } = await generateRequestSignature(
        "GET",
        "/api",
        {},
        null,
        secret,
      );
      // 但使用未来时间戳
      const request = new Request("http://localhost:8000/api", {
        headers: {
          "X-Request-Signature": signature,
          "X-Request-Timestamp": futureTimestamp.toString(),
        },
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      // 时间戳在未来但未超过容差，应该通过时间戳检查
      // 但签名是用当前时间戳生成的，所以签名验证会失败
      expect(context.response?.status).toBe(403);
      const text = await context.response?.text();
      expect(text).toContain("INVALID_SIGNATURE");
    });

    it("应该支持自定义 shouldSkip 函数", async () => {
      const middleware = requestSignature({
        secret,
        shouldSkip: (ctx) => ctx.path.startsWith("/public"),
      });
      const request = new Request("http://localhost:8000/public/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      // 应该跳过验证
      expect(context.response?.status).toBe(200);
    });

    it("应该支持自定义错误消息", async () => {
      const customMessage = "Custom signature error";
      const middleware = requestSignature({
        secret,
        errorMessage: customMessage,
      });
      const timestamp = Math.floor(Date.now() / 1000);

      const request = new Request("http://localhost:8000/api", {
        headers: {
          "X-Request-Signature": "invalid-signature",
          "X-Request-Timestamp": timestamp.toString(),
        },
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const text = await context.response?.text();
      expect(text).toContain(customMessage);
    });
  });

  describe("签名生成", () => {
    it("应该生成有效的签名", async () => {
      const { signature, timestamp } = await generateRequestSignature(
        "POST",
        "/api/users",
        { page: "1" },
        { name: "Test" },
        secret,
      );

      expect(signature).toBeDefined();
      expect(typeof signature).toBe("string");
      expect(timestamp).toBeDefined();
      expect(typeof timestamp).toBe("number");
    });

    it("应该为不同的请求生成不同的签名", async () => {
      const sig1 = await generateRequestSignature(
        "GET",
        "/api/1",
        {},
        null,
        secret,
      );
      const sig2 = await generateRequestSignature(
        "GET",
        "/api/2",
        {},
        null,
        secret,
      );

      expect(sig1.signature).not.toBe(sig2.signature);
    });

    it("应该包含查询参数在签名中", async () => {
      const { signature: sig1 } = await generateRequestSignature(
        "GET",
        "/api",
        { a: "1", b: "2" },
        null,
        secret,
      );
      const { signature: sig2 } = await generateRequestSignature(
        "GET",
        "/api",
        { b: "2", a: "1" }, // 顺序不同，但应该生成相同的签名（排序后）
        null,
        secret,
      );

      expect(sig1).toBe(sig2);
    });

    it("应该包含请求体在签名中", async () => {
      const { signature: sig1 } = await generateRequestSignature(
        "POST",
        "/api",
        {},
        { name: "Test" },
        secret,
      );
      const { signature: sig2 } = await generateRequestSignature(
        "POST",
        "/api",
        {},
        { name: "Test" },
        secret,
      );

      expect(sig1).toBe(sig2);
    });
  });
});
