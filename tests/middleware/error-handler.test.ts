/**
 * 错误处理中间件测试
 */

import { describe, expect, it } from "@dreamer/test";
import { errorHandler } from "../../src/middleware/error-handler.ts";
import { createTestContext } from "../helpers.ts";

describe("Error Handler 中间件", () => {
  describe("基础功能", () => {
    it("应该创建错误处理中间件", () => {
      const middleware = errorHandler();
      expect(typeof middleware).toBe("function");
    });

    it("应该处理同步错误", async () => {
      const middleware = errorHandler();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);
      const error = new Error("Test error");

      await middleware(context, error, async () => {});

      expect(context.response?.status).toBe(500);
      const text = await context.response?.text();
      expect(text).toContain("Test error");
    });

    it("应该处理异步错误", async () => {
      const middleware = errorHandler();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);
      const error = new Error("Async error");

      await middleware(context, error, async () => {});

      expect(context.response?.status).toBe(500);
    });
  });

  describe("配置选项", () => {
    it("应该支持自定义错误格式化函数", async () => {
      const middleware = errorHandler({
        formatError: (
          error,
          _ctx,
          _isDev,
          _includeDetails,
          _provideSuggestions,
        ) => {
          return {
            status: 500,
            message: error.message,
            code: "CUSTOM_ERROR",
            timestamp: new Date().toISOString(),
          };
        },
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      const error = new Error("Test error");
      await middleware(context, error, async () => {});

      const text = await context.response?.text() || "";
      expect(text).toContain("CUSTOM_ERROR");
    });

    it("应该支持 includeDetails 选项", async () => {
      const middleware = errorHandler({
        includeDetails: true,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test.js:1:1";

      await middleware(context, error, async () => {});

      const text = await context.response?.text() || "";
      const json = JSON.parse(text);
      expect(json.error.details).toBeDefined();
      expect(json.error.details.stack).toBeDefined();
    });

    it("应该支持开发模式", async () => {
      const middleware = errorHandler({
        isDev: true,
      });
      const request = new Request("http://localhost:8000/api/test?id=123");
      const context = createTestContext(request);
      context.params = { id: "456" };
      context.query = { id: "123" };
      const error = new Error("Test error");

      await middleware(context, error, async () => {});

      const text = await context.response?.text() || "";
      const json = JSON.parse(text);
      expect(json.error.details).toBeDefined();
      expect(json.error.details.context).toBeDefined();
      expect(json.error.details.context.method).toBe("GET");
      expect(json.error.details.context.path).toBe("/api/test");
      expect(json.error.details.context.params).toEqual({ id: "456" });
      expect(json.error.details.context.query).toEqual({ id: "123" });
    });

    it("应该支持错误修复建议", async () => {
      const middleware = errorHandler({
        isDev: true,
        provideSuggestions: true,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);
      const error = new Error("Cannot read property 'x' of undefined");

      await middleware(context, error, async () => {});

      const text = await context.response?.text() || "";
      const json = JSON.parse(text);
      expect(json.error.details).toBeDefined();
      expect(json.error.details.suggestions).toBeDefined();
      expect(Array.isArray(json.error.details.suggestions)).toBe(true);
      expect(json.error.details.suggestions.length).toBeGreaterThan(0);
    });

    it("开发模式下应该格式化 JSON 响应", async () => {
      const middleware = errorHandler({
        isDev: true,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);
      const error = new Error("Test error");

      await middleware(context, error, async () => {});

      const text = await context.response?.text() || "";
      // 开发模式下应该使用缩进格式化
      expect(text).toContain("\n");
    });

    it("生产模式下不应该格式化 JSON 响应", async () => {
      const middleware = errorHandler({
        isDev: false,
        includeDetails: false,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);
      const error = new Error("Test error");

      await middleware(context, error, async () => {});

      const text = await context.response?.text() || "";
      // 生产模式下不应该有缩进
      const lines = text.split("\n");
      expect(lines.length).toBe(1);
    });
  });
});
