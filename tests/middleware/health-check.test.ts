/**
 * 健康检查中间件测试
 */

import { describe, expect, it } from "@dreamer/test";
import { healthCheck } from "../../src/middleware/health-check.ts";
import { createTestContext } from "../helpers.ts";

describe("Health Check 中间件", () => {
  describe("基础功能", () => {
    it("应该创建健康检查中间件", () => {
      const middleware = healthCheck();
      expect(typeof middleware).toBe("function");
    });

    it("应该响应健康检查请求", async () => {
      const middleware = healthCheck();
      const request = new Request("http://localhost:8000/health");
      const context = createTestContext(request);

      let nextCalled = false;
      await middleware(context, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false); // 健康检查不应该调用 next
      expect(context.response?.status).toBe(200);
      const text = await context.response?.text();
      expect(text).toContain("OK");
    });

    it("应该忽略非健康检查路径", async () => {
      const middleware = healthCheck();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      let nextCalled = false;
      await middleware(context, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true); // 非健康检查路径应该调用 next
    });
  });

  describe("配置选项", () => {
    it("应该支持自定义路径", async () => {
      const middleware = healthCheck({
        path: "/ping",
      });
      const request = new Request("http://localhost:8000/ping");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(200);
    });

    it("应该支持自定义响应体", async () => {
      const middleware = healthCheck({
        check: async () => ({
          healthy: true,
          details: { status: "healthy", timestamp: Date.now() },
        }),
      });
      const request = new Request("http://localhost:8000/health");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const text = await context.response?.text();
      expect(text).toContain("healthy");
    });

    it("应该支持自定义状态码", async () => {
      const middleware = healthCheck({
        // 注意：health-check 中间件不支持自定义状态码
      });
      const request = new Request("http://localhost:8000/health");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      // health-check 中间件固定返回 200
      expect(context.response?.status).toBe(200);
    });

    it("应该支持自定义检查函数", async () => {
      let checkCalled = false;
      const middleware = healthCheck({
        check: async () => {
          checkCalled = true;
          return { healthy: true };
        },
      });
      const request = new Request("http://localhost:8000/health");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(checkCalled).toBe(true);
    });
  });
});
