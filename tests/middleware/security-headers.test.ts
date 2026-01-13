/**
 * 安全头中间件测试
 */

import { describe, expect, it } from "@dreamer/test";
import { securityHeaders } from "../../src/middleware/security-headers.ts";
import { createTestContext } from "../helpers.ts";

describe("Security Headers 中间件", () => {
  describe("基础功能", () => {
    it("应该创建安全头中间件", () => {
      const middleware = securityHeaders();
      expect(typeof middleware).toBe("function");
    });

    it("应该设置默认安全头", async () => {
      const middleware = securityHeaders();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      expect(context.response?.headers.get("X-Frame-Options")).toBe("DENY");
      expect(context.response?.headers.get("X-Content-Type-Options")).toBe(
        "nosniff",
      );
      expect(context.response?.headers.get("X-XSS-Protection")).toBe(
        "1; mode=block",
      );
      expect(context.response?.headers.get("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin",
      );
    });
  });

  describe("新增安全头", () => {
    it("应该支持 Cross-Origin-Embedder-Policy", async () => {
      const middleware = securityHeaders({
        crossOriginEmbedderPolicy: "require-corp",
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      expect(context.response?.headers.get("Cross-Origin-Embedder-Policy"))
        .toBe(
          "require-corp",
        );
    });

    it("应该支持 Cross-Origin-Opener-Policy", async () => {
      const middleware = securityHeaders({
        crossOriginOpenerPolicy: "same-origin",
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      expect(context.response?.headers.get("Cross-Origin-Opener-Policy")).toBe(
        "same-origin",
      );
    });

    it("应该支持 Cross-Origin-Resource-Policy", async () => {
      const middleware = securityHeaders({
        crossOriginResourcePolicy: "same-origin",
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      expect(context.response?.headers.get("Cross-Origin-Resource-Policy"))
        .toBe("same-origin");
    });

    it("应该支持 X-DNS-Prefetch-Control", async () => {
      const middleware = securityHeaders({
        dnsPrefetchControl: "on",
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      expect(context.response?.headers.get("X-DNS-Prefetch-Control")).toBe(
        "on",
      );
    });

    it("应该支持 X-Download-Options", async () => {
      const middleware = securityHeaders({
        downloadOptions: true,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      expect(context.response?.headers.get("X-Download-Options")).toBe(
        "noopen",
      );
    });

    it("应该支持 X-Permitted-Cross-Domain-Policies", async () => {
      const middleware = securityHeaders({
        permittedCrossDomainPolicies: "none",
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      expect(context.response?.headers.get("X-Permitted-Cross-Domain-Policies"))
        .toBe("none");
    });
  });

  describe("动态安全策略", () => {
    it("应该支持动态安全策略函数", async () => {
      const middleware = securityHeaders({
        contentSecurityPolicy: "default-src 'self'",
        dynamicPolicy: (ctx) => {
          if (ctx.path.startsWith("/api")) {
            return { contentSecurityPolicy: false };
          }
          return {};
        },
      });

      // API 路径应该禁用 CSP
      const apiRequest = new Request("http://localhost:8000/api/users");
      const apiContext = createTestContext(apiRequest);
      await middleware(apiContext, async () => {
        apiContext.response = new Response("OK", { status: 200 });
      });
      expect(apiContext.response?.headers.get("Content-Security-Policy"))
        .toBeNull();

      // 其他路径应该启用 CSP
      const pageRequest = new Request("http://localhost:8000/page");
      const pageContext = createTestContext(pageRequest);
      await middleware(pageContext, async () => {
        pageContext.response = new Response("OK", { status: 200 });
      });
      expect(pageContext.response?.headers.get("Content-Security-Policy")).toBe(
        "default-src 'self'",
      );
    });

    it("应该支持异步动态安全策略函数", async () => {
      const middleware = securityHeaders({
        crossOriginEmbedderPolicy: false,
        dynamicPolicy: async (ctx) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          if (ctx.method === "POST") {
            return { crossOriginEmbedderPolicy: "require-corp" };
          }
          return {};
        },
      });

      const postRequest = new Request("http://localhost:8000/api", {
        method: "POST",
      });
      const postContext = createTestContext(postRequest);
      await middleware(postContext, async () => {
        postContext.response = new Response("OK", { status: 200 });
      });

      expect(postContext.response?.headers.get("Cross-Origin-Embedder-Policy"))
        .toBe(
          "require-corp",
        );
    });
  });

  describe("配置验证", () => {
    it("应该支持配置验证", async () => {
      const middleware = securityHeaders({
        validateConfig: true,
        contentSecurityPolicy: "script-src 'self'", // 没有 default-src，应该警告
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      // 应该不抛出错误，只输出警告
      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      expect(context.response?.status).toBe(200);
    });

    it("应该验证 COEP 和 COOP 的组合", async () => {
      const middleware = securityHeaders({
        validateConfig: true,
        crossOriginEmbedderPolicy: "require-corp",
        crossOriginOpenerPolicy: "unsafe-none", // 应该警告
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      // 应该不抛出错误，只输出警告
      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      expect(context.response?.status).toBe(200);
    });
  });

  describe("配置选项", () => {
    it("应该支持禁用默认安全头", async () => {
      const middleware = securityHeaders({
        frameOptions: false,
        contentTypeOptions: false,
        xssProtection: false,
        referrerPolicy: false,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      expect(context.response?.headers.get("X-Frame-Options")).toBeNull();
      expect(context.response?.headers.get("X-Content-Type-Options"))
        .toBeNull();
      expect(context.response?.headers.get("X-XSS-Protection")).toBeNull();
      expect(context.response?.headers.get("Referrer-Policy")).toBeNull();
    });

    it("应该支持自定义安全头值", async () => {
      const middleware = securityHeaders({
        frameOptions: "SAMEORIGIN",
        referrerPolicy: "no-referrer",
        contentSecurityPolicy:
          "default-src 'self'; script-src 'self' 'unsafe-inline'",
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      expect(context.response?.headers.get("X-Frame-Options")).toBe(
        "SAMEORIGIN",
      );
      expect(context.response?.headers.get("Referrer-Policy")).toBe(
        "no-referrer",
      );
      expect(context.response?.headers.get("Content-Security-Policy"))
        .toContain(
          "default-src 'self'",
        );
    });
  });
});
