/**
 * 性能分析中间件测试
 */

import { afterEach, describe, expect, it } from "@dreamer/test";
import {
  clearPerformanceData,
  getPerformanceStats,
  performanceAnalyzer,
} from "../../src/middleware/performance-analyzer.ts";
import { createTestContext } from "../helpers.ts";

describe("Performance Analyzer 中间件", () => {
  afterEach(() => {
    clearPerformanceData();
  });

  describe("基础功能", () => {
    it("应该创建性能分析中间件", () => {
      const middleware = performanceAnalyzer();
      expect(typeof middleware).toBe("function");
    });

    it("应该记录请求性能数据", async () => {
      const middleware = performanceAnalyzer();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
        // 模拟一些处理时间
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const stats = getPerformanceStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.requests.length).toBe(1);
      expect(stats.requests[0].method).toBe("GET");
      expect(stats.requests[0].path).toBe("/api");
      expect(stats.requests[0].duration).toBeDefined();
      expect(stats.requests[0].duration!).toBeGreaterThanOrEqual(10);
    });

    it("应该提供性能报告端点", async () => {
      const middleware = performanceAnalyzer({ endpoint: "/__performance" });
      const request = new Request("http://localhost:8000/__performance");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(200);
      expect(context.response?.headers.get("Content-Type")).toContain("text/html");
      const html = await context.response?.text();
      expect(html).toContain("性能分析报告");
    });

    it("应该支持自定义端点路径", async () => {
      const customEndpoint = "/dev/performance";
      const middleware = performanceAnalyzer({ endpoint: customEndpoint });
      const request = new Request(`http://localhost:8000${customEndpoint}`);
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(200);
      const html = await context.response?.text();
      expect(html).toContain("性能分析报告");
    });
  });

  describe("慢请求检测", () => {
    it("应该检测慢请求", async () => {
      const middleware = performanceAnalyzer({
        slowRequestThreshold: 50,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
        // 模拟慢请求
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const stats = getPerformanceStats();
      expect(stats.slowRequests).toBe(1);
      expect(stats.slowRequestsList.length).toBe(1);
      expect(stats.slowRequestsList[0].isSlow).toBe(true);
    });

    it("应该不将快速请求标记为慢请求", async () => {
      const middleware = performanceAnalyzer({
        slowRequestThreshold: 1000,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const stats = getPerformanceStats();
      expect(stats.slowRequests).toBe(0);
      expect(stats.requests[0].isSlow).toBeUndefined();
    });

    it("应该支持禁用慢请求日志", async () => {
      const middleware = performanceAnalyzer({
        slowRequestThreshold: 50,
        logSlowRequests: false,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      // 不应该抛出错误或输出日志
      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const stats = getPerformanceStats();
      expect(stats.slowRequests).toBe(1);
    });
  });

  describe("配置选项", () => {
    it("应该支持禁用性能分析", async () => {
      const middleware = performanceAnalyzer({ enabled: false });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      const stats = getPerformanceStats();
      expect(stats.totalRequests).toBe(0);
    });

    it("应该支持自定义慢请求阈值", async () => {
      const middleware = performanceAnalyzer({
        slowRequestThreshold: 200,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      const stats = getPerformanceStats();
      expect(stats.slowRequests).toBe(0); // 150ms < 200ms，不是慢请求

      // 再次请求，超过阈值
      const context2 = createTestContext(request);
      await middleware(context2, async () => {
        context2.response = new Response("OK", { status: 200 });
        await new Promise((resolve) => setTimeout(resolve, 250));
      });

      const stats2 = getPerformanceStats();
      expect(stats2.slowRequests).toBe(1); // 250ms > 200ms，是慢请求
    });

    it("应该限制最大记录数", async () => {
      const middleware = performanceAnalyzer({ maxRecords: 5 });
      const request = new Request("http://localhost:8000/api");

      // 创建 10 个请求
      for (let i = 0; i < 10; i++) {
        const context = createTestContext(request);
        await middleware(context, async () => {
          context.response = new Response("OK", { status: 200 });
        });
      }

      const stats = getPerformanceStats();
      expect(stats.totalRequests).toBe(5); // 应该只保留最新的 5 条
    });
  });

  describe("性能统计", () => {
    it("应该提供性能统计数据", () => {
      const stats = getPerformanceStats();
      expect(stats).toHaveProperty("totalRequests");
      expect(stats).toHaveProperty("slowRequests");
      expect(stats).toHaveProperty("middlewareCount");
      expect(stats).toHaveProperty("requests");
      expect(stats).toHaveProperty("slowRequestsList");
      expect(stats).toHaveProperty("middlewareStats");
    });

    it("应该能够清空性能数据", async () => {
      const middleware = performanceAnalyzer();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      let stats = getPerformanceStats();
      expect(stats.totalRequests).toBe(1);

      clearPerformanceData();
      stats = getPerformanceStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.slowRequests).toBe(0);
      expect(stats.middlewareCount).toBe(0);
    });
  });

  describe("请求记录", () => {
    it("应该记录请求的详细信息", async () => {
      const middleware = performanceAnalyzer();
      const request = new Request("http://localhost:8000/api/users?id=123", {
        method: "POST",
      });
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("Created", { status: 201 });
      });

      const stats = getPerformanceStats();
      const record = stats.requests[0];
      expect(record.method).toBe("POST");
      expect(record.path).toBe("/api/users");
      expect(record.url).toContain("/api/users");
      expect(record.status).toBe(201);
      expect(record.duration).toBeDefined();
      expect(record.requestId).toBeDefined();
    });
  });
});
