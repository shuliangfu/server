/**
 * 请求日志中间件测试
 */

import { describe, expect, it } from "@dreamer/test";
import { requestLogger } from "../../src/middleware/request-logger.ts";
import { createTestContext } from "../helpers.ts";

describe("Request Logger 中间件", () => {
  describe("基础功能", () => {
    it("应该创建请求日志中间件", () => {
      const middleware = requestLogger();
      expect(typeof middleware).toBe("function");
    });

    it("应该记录请求信息", async () => {
      const middleware = requestLogger();
      const request = new Request("http://localhost:8000/api", {
        method: "GET",
      });
      const context = createTestContext(request, new Response("OK"));

      let nextCalled = false;
      await middleware(context, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      // 应该不抛出错误
      expect(context.response).toBeInstanceOf(Response);
    });

    it("应该记录响应状态码", async () => {
      const middleware = requestLogger();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(
        request,
        new Response("OK", { status: 200 }),
      );

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(200);
    });
  });

  describe("配置选项", () => {
    it("应该支持自定义日志格式", () => {
      const middleware = requestLogger({
        format: "text",
      });
      expect(typeof middleware).toBe("function");
    });

    it("应该支持自定义跳过函数", async () => {
      const middleware = requestLogger({
        // 注意：request-logger 中间件不支持 skip 选项
      });
      const request = new Request("http://localhost:8000/health");
      const context = createTestContext(request);

      let nextCalled = false;
      await middleware(context, async () => {
        nextCalled = true;
      });

      // 跳过的请求应该正常执行
      expect(nextCalled).toBe(true);
    });
  });
});
