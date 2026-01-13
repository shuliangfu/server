/**
 * CORS 中间件测试
 */

import { describe, expect, it } from "@dreamer/test";
import { cors } from "../../src/middleware/cors.ts";
import { createTestContext } from "../helpers.ts";

describe("CORS 中间件", () => {
  describe("基础功能", () => {
    it("应该创建 CORS 中间件", () => {
      const middleware = cors();
      expect(typeof middleware).toBe("function");
    });

    it("应该处理 OPTIONS 预检请求", async () => {
      const middleware = cors();
      const request = new Request("http://localhost:8000/api", {
        method: "OPTIONS",
        headers: {
          "Origin": "http://localhost:3000",
          "Access-Control-Request-Method": "GET",
        },
      });
      const context = createTestContext(request);

      let nextCalled = false;
      await middleware(context, async () => {
        nextCalled = true;
      });

      expect(context.response?.status).toBe(204);
      expect(context.response?.headers.get("Access-Control-Allow-Origin")).toBe(
        "*",
      );
      expect(nextCalled).toBe(false); // OPTIONS 请求不应该调用 next
    });

    it("应该添加 CORS 头到响应", async () => {
      const middleware = cors();
      const request = new Request("http://localhost:8000/api", {
        method: "GET",
        headers: {
          "Origin": "http://localhost:3000",
        },
      });
      const context = createTestContext(request, new Response("OK"));

      await middleware(context, async () => {});

      expect(context.response?.headers.get("Access-Control-Allow-Origin")).toBe(
        "*",
      );
    });
  });

  describe("配置选项", () => {
    it("应该支持自定义 origin", async () => {
      const middleware = cors({
        origin: "http://localhost:3000",
      });
      const request = new Request("http://localhost:8000/api", {
        method: "GET",
        headers: {
          "Origin": "http://localhost:3000",
        },
      });
      const context = createTestContext(request, new Response("OK"));

      await middleware(context, async () => {});

      expect(context.response?.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000",
      );
    });

    it("应该支持自定义方法", async () => {
      const middleware = cors({
        methods: ["GET", "POST"],
      });
      const request = new Request("http://localhost:8000/api", {
        method: "OPTIONS",
        headers: {
          "Origin": "http://localhost:3000",
          "Access-Control-Request-Method": "POST",
        },
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const allowMethods = context.response?.headers.get(
        "Access-Control-Allow-Methods",
      );
      expect(allowMethods).toContain("GET");
      expect(allowMethods).toContain("POST");
    });

    it("应该支持自定义允许的头部", async () => {
      const middleware = cors({
        allowedHeaders: ["Content-Type", "Authorization"],
      });
      const request = new Request("http://localhost:8000/api", {
        method: "OPTIONS",
        headers: {
          "Origin": "http://localhost:3000",
          "Access-Control-Request-Headers": "Content-Type,Authorization",
        },
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const allowHeaders = context.response?.headers.get(
        "Access-Control-Allow-Headers",
      );
      expect(allowHeaders).toContain("Content-Type");
      expect(allowHeaders).toContain("Authorization");
    });

    it("应该支持自定义凭证", async () => {
      const middleware = cors({
        credentials: true,
      });
      const request = new Request("http://localhost:8000/api", {
        method: "GET",
        headers: {
          "Origin": "http://localhost:3000",
        },
      });
      const context = createTestContext(request, new Response("OK"));

      await middleware(context, async () => {});

      expect(
        context.response?.headers.get("Access-Control-Allow-Credentials"),
      ).toBe("true");
    });

    it("应该支持自定义最大年龄", async () => {
      const middleware = cors({
        maxAge: 3600,
      });
      const request = new Request("http://localhost:8000/api", {
        method: "OPTIONS",
        headers: {
          "Origin": "http://localhost:3000",
        },
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.response?.headers.get("Access-Control-Max-Age")).toBe(
        "3600",
      );
    });
  });
});
