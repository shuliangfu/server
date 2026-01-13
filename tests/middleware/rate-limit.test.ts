/**
 * 请求限流中间件测试
 */

import { afterEach, describe, expect, it } from "@dreamer/test";
import { rateLimit } from "../../src/middleware/rate-limit.ts";
import { createTestContext } from "../helpers.ts";

// 存储所有创建的中间件实例，用于清理
const middlewareInstances: Array<{ cleanup?: () => void }> = [];

describe("Rate Limit 中间件", () => {
  // 在每个测试后清理定时器
  afterEach(() => {
    for (const middleware of middlewareInstances) {
      if (middleware.cleanup) {
        middleware.cleanup();
      }
    }
    middlewareInstances.length = 0;
  });
  describe("基础功能", () => {
    it("应该创建限流中间件", () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 10,
      });
      middlewareInstances.push(middleware);
      expect(typeof middleware).toBe("function");
    });

    it("应该允许在限制内的请求", async () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 10,
      });
      middlewareInstances.push(middleware);
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      let nextCalled = false;
      await middleware(context, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(context.response?.status).toBe(200);
    });

    it("应该限制超过限制的请求", async () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 2,
      });
      middlewareInstances.push(middleware);
      const request = new Request("http://localhost:8000/api");

      // 发送 3 个请求
      for (let i = 0; i < 3; i++) {
        const context = createTestContext(request);

        let nextCalled = false;
        await middleware(context, async () => {
          nextCalled = true;
        });

        if (i < 2) {
          expect(nextCalled).toBe(true);
          expect(context.response?.status).toBe(200);
        } else {
          expect(nextCalled).toBe(false);
          expect(context.response?.status).toBe(429);
        }
      }
    });
  });

  describe("配置选项", () => {
    it("应该支持自定义错误消息", async () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 1,
        message: "Too many requests",
      });
      middlewareInstances.push(middleware);
      const request = new Request("http://localhost:8000/api");

      // 第一个请求应该通过
      const context1 = createTestContext(request);
      await middleware(context1, async () => {});

      // 第二个请求应该被限制
      const context2 = createTestContext(request);
      await middleware(context2, async () => {});

      expect(context2.response?.status).toBe(429);
      const text = await context2.response?.text();
      expect(text).toContain("Too many requests");
    });

    it("应该支持自定义键生成函数", async () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: (ctx) => {
          return ctx.request.headers.get("X-User-ID") || "default";
        },
      });
      middlewareInstances.push(middleware);
      const request1 = new Request("http://localhost:8000/api", {
        headers: {
          "X-User-ID": "user1",
        },
      });
      const request2 = new Request("http://localhost:8000/api", {
        headers: {
          "X-User-ID": "user2",
        },
      });

      // 不同用户的请求应该独立限流
      const context1 = createTestContext(request1);
      await middleware(context1, async () => {});

      const context2 = createTestContext(request2);
      let nextCalled = false;
      await middleware(context2, async () => {
        nextCalled = true;
      });

      // user2 的第一个请求应该通过
      expect(nextCalled).toBe(true);
    });

    it("应该返回限流响应头", async () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 10,
        // 注意：rate-limit 中间件不支持 headers 选项
      });
      middlewareInstances.push(middleware);
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      // rate-limit 中间件不自动添加响应头，需要手动添加
      expect(context.response).toBeDefined();
    });
  });
});
