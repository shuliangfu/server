/**
 * 请求超时中间件测试
 */

import { afterEach, describe, expect, it } from "@dreamer/test";
import { timeout } from "../../src/middleware/timeout.ts";
import { createTestContext } from "../helpers.ts";

// 存储所有创建的定时器 ID，用于清理
const timeoutIds: Array<ReturnType<typeof setTimeout>> = [];

describe("Timeout 中间件", () => {
  // 在每个测试后清理所有定时器
  afterEach(() => {
    for (const id of timeoutIds) {
      clearTimeout(id);
    }
    timeoutIds.length = 0;
  });
  describe("基础功能", () => {
    it("应该创建超时中间件", () => {
      const middleware = timeout({
        timeout: 1000,
      });
      expect(typeof middleware).toBe("function");
    });

    it("应该允许在超时内的请求", async () => {
      const middleware = timeout({
        timeout: 1000,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      let nextCalled = false;
      await middleware(context, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it("应该超时超过时间的请求", async () => {
      const middleware = timeout({
        timeout: 100,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      let nextCalled = false;
      await middleware(context, async () => {
        // 模拟长时间操作（超过超时时间）
        await new Promise((resolve) => {
          const timerId = setTimeout(resolve, 200);
          timeoutIds.push(timerId);
        });
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(context.response?.status).toBe(408);
    });
  });

  describe("配置选项", () => {
    it("应该支持自定义错误消息", async () => {
      const middleware = timeout({
        timeout: 100,
        message: "Request timeout",
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        await new Promise((resolve) => {
          const timerId = setTimeout(resolve, 200);
          timeoutIds.push(timerId);
        });
      });

      expect(context.response?.status).toBe(408);
      const text = await context.response?.text();
      expect(text).toContain("Request timeout");
    });

    it("应该支持跳过函数", async () => {
      const middleware = timeout({
        timeout: 100,
        skip: (ctx) => ctx.request.url.includes("/health"),
      });
      const request = new Request("http://localhost:8000/health");
      const context = createTestContext(request);

      let nextCalled = false;
      await middleware(context, async () => {
        // 即使超过超时时间，也应该执行
        await new Promise((resolve) => setTimeout(resolve, 200));
        nextCalled = true;
      });

      // 跳过的请求应该正常执行
      expect(nextCalled).toBe(true);
    });
  });
});
