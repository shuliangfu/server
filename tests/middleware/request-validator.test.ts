/**
 * 请求验证中间件测试
 */

import { describe, expect, it } from "@dreamer/test";
import { requestValidator } from "../../src/middleware/request-validator.ts";
import { createTestContext } from "../helpers.ts";

describe("Request Validator 中间件", () => {
  describe("基础功能", () => {
    it("应该创建请求验证中间件", () => {
      const middleware = requestValidator();
      expect(typeof middleware).toBe("function");
    });

    it("应该允许通过未配置的请求", async () => {
      const middleware = requestValidator();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      expect(context.response?.status).toBe(200);
    });
  });

  describe("请求大小限制", () => {
    it("应该限制请求体大小", async () => {
      const middleware = requestValidator({ maxBodySize: 100 });
      const largeBody = "x".repeat(200);
      const request = new Request("http://localhost:8000/api", {
        method: "POST",
        body: largeBody,
      });
      const context = createTestContext(request);
      context.body = largeBody;

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(413);
      const text = await context.response?.text();
      expect(text).toContain("Request body too large");
    });

    it("应该允许小于限制的请求体", async () => {
      const middleware = requestValidator({ maxBodySize: 1000 });
      const smallBody = "x".repeat(100);
      const request = new Request("http://localhost:8000/api", {
        method: "POST",
      });
      const context = createTestContext(request);
      context.body = smallBody;

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      expect(context.response?.status).toBe(200);
    });

    it("应该限制 URL 长度", async () => {
      const middleware = requestValidator({ maxUrlLength: 100 });
      const longPath = "/api/" + "x".repeat(200);
      const request = new Request(`http://localhost:8000${longPath}`);
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(413);
      const text = await context.response?.text();
      expect(text).toContain("URL too long");
    });

    it("应该限制查询参数数量", async () => {
      const middleware = requestValidator({ maxQueryParams: 5 });
      const params = new URLSearchParams();
      for (let i = 0; i < 10; i++) {
        params.append(`param${i}`, `value${i}`);
      }
      const request = new Request(`http://localhost:8000/api?${params}`);
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(413);
      const text = await context.response?.text();
      expect(text).toContain("Too many query parameters");
    });
  });

  describe("字段验证", () => {
    it("应该验证必需字段", async () => {
      const middleware = requestValidator({
        rules: [
          {
            field: "email",
            required: true,
            validate: () => true,
          },
        ],
      });
      const request = new Request("http://localhost:8000/api", {
        method: "POST",
      });
      const context = createTestContext(request);
      context.body = {};

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(400);
      const text = await context.response?.text();
      expect(text).toContain("email");
      expect(text).toContain("required");
    });

    it("应该验证字段格式", async () => {
      const middleware = requestValidator({
        rules: [
          {
            field: "email",
            required: true,
            validate: (value) => {
              return typeof value === "string" && value.includes("@");
            },
            message: "Invalid email format",
          },
        ],
      });
      const request = new Request("http://localhost:8000/api", {
        method: "POST",
      });
      const context = createTestContext(request);
      context.body = { email: "invalid-email" };

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(400);
      const text = await context.response?.text();
      expect(text).toContain("Invalid email format");
    });

    it("应该接受有效的字段值", async () => {
      const middleware = requestValidator({
        rules: [
          {
            field: "email",
            required: true,
            validate: (value) => {
              return typeof value === "string" && value.includes("@");
            },
          },
        ],
      });
      const request = new Request("http://localhost:8000/api", {
        method: "POST",
      });
      const context = createTestContext(request);
      context.body = { email: "test@example.com" };

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      expect(context.response?.status).toBe(200);
    });

    it("应该支持自定义错误消息", async () => {
      const middleware = requestValidator({
        rules: [
          {
            field: "email",
            required: true,
            validate: () => false,
            message: "Custom error message",
          },
        ],
      });
      const request = new Request("http://localhost:8000/api", {
        method: "POST",
      });
      const context = createTestContext(request);
      context.body = { email: "test@example.com" };

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(400);
      const text = await context.response?.text();
      expect(text).toContain("Custom error message");
    });

    it("应该支持验证函数返回错误消息", async () => {
      const middleware = requestValidator({
        rules: [
          {
            field: "age",
            validate: (value) => {
              if (typeof value !== "number") {
                return "Age must be a number";
              }
              if (value < 0 || value > 150) {
                return "Age must be between 0 and 150";
              }
              return true;
            },
          },
        ],
      });
      const request = new Request("http://localhost:8000/api", {
        method: "POST",
      });
      const context = createTestContext(request);
      context.body = { age: 200 };

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(400);
      const text = await context.response?.text();
      expect(text).toContain("Age must be between 0 and 150");
    });
  });

  describe("自定义验证", () => {
    it("应该支持自定义验证函数", async () => {
      const middleware = requestValidator({
        validate: (ctx) => {
          if (ctx.method === "POST" && !ctx.body) {
            return "POST requests must have a body";
          }
          return true;
        },
      });
      const request = new Request("http://localhost:8000/api", {
        method: "POST",
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(400);
      const text = await context.response?.text();
      expect(text).toContain("POST requests must have a body");
    });

    it("应该支持异步自定义验证函数", async () => {
      const middleware = requestValidator({
        validate: async (ctx) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          if (ctx.path === "/api/admin") {
            return "Admin access denied";
          }
          return true;
        },
      });
      const request = new Request("http://localhost:8000/api/admin");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(400);
      const text = await context.response?.text();
      expect(text).toContain("Admin access denied");
    });
  });

  describe("配置选项", () => {
    it("应该支持 shouldSkip 函数", async () => {
      const middleware = requestValidator({
        maxBodySize: 10,
        shouldSkip: (ctx) => ctx.path.startsWith("/api/public"),
      });
      const largeBody = "x".repeat(100);
      const request = new Request("http://localhost:8000/api/public/data");
      const context = createTestContext(request);
      context.body = largeBody;

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      // 应该跳过验证
      expect(context.response?.status).toBe(200);
    });

    it("应该支持自定义错误格式化函数", async () => {
      const middleware = requestValidator({
        rules: [
          {
            field: "email",
            required: true,
            validate: () => true,
          },
        ],
        formatError: (field, message) => `[${field}]: ${message}`,
      });
      const request = new Request("http://localhost:8000/api", {
        method: "POST",
      });
      const context = createTestContext(request);
      context.body = {};

      await middleware(context, async () => {});

      const text = await context.response?.text();
      expect(text).toContain("[email]");
    });
  });
});
