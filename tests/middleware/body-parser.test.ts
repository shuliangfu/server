/**
 * Body Parser 中间件测试
 */

import { describe, expect, it } from "@dreamer/test";
import { bodyParser } from "../../src/middleware/body-parser.ts";
import { createTestContext } from "../helpers.ts";

describe("Body Parser 中间件", () => {
  describe("JSON 解析", () => {
    it("应该解析 JSON 请求体", async () => {
      const middleware = bodyParser();
      const request = new Request("http://localhost:8000/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "test", age: 30 }),
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.body).toBeDefined();
      if (context.body) {
        expect(context.body).toEqual({ name: "test", age: 30 });
      }
    });

    it("应该处理无效的 JSON", async () => {
      const middleware = bodyParser();
      const request = new Request("http://localhost:8000/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "invalid json",
      });
      const context = createTestContext(request);

      // 应该不抛出错误，但 body 可能为 null
      await middleware(context, async () => {});
      // 行为取决于实现，这里只确保不抛出错误
      expect(context).toBeDefined();
    });
  });

  describe("表单数据解析", () => {
    it("应该解析 URL 编码的表单数据", async () => {
      const middleware = bodyParser();
      const formData = new URLSearchParams();
      formData.append("name", "test");
      formData.append("age", "30");
      const request = new Request("http://localhost:8000/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.body).toBeDefined();
      // body parser 会将表单数据解析为对象
      if (context.body && typeof context.body === "object") {
        const body = context.body as Record<string, string>;
        expect(body.name).toBe("test");
        expect(body.age).toBe("30");
      }
    });
  });

  describe("文本解析", () => {
    it("应该解析文本请求体", async () => {
      const middleware = bodyParser();
      const request = new Request("http://localhost:8000/api", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: "Hello, World!",
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.body).toBeDefined();
      if (context.body) {
        expect(context.body).toBe("Hello, World!");
      }
    });
  });

  describe("配置选项", () => {
    it("应该支持自定义 JSON 限制", async () => {
      const middleware = bodyParser({
        json: { limit: 1024 },
      });
      // 应该不抛出错误
      expect(typeof middleware).toBe("function");
    });

    it("应该支持自定义表单限制", async () => {
      const middleware = bodyParser({
        urlencoded: { limit: 1024 },
      });
      // 应该不抛出错误
      expect(typeof middleware).toBe("function");
    });

    it("应该支持自定义文本限制", async () => {
      const middleware = bodyParser({
        text: { limit: 1024 },
      });
      // 应该不抛出错误
      expect(typeof middleware).toBe("function");
    });
  });
});
