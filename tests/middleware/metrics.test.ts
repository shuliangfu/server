/**
 * Metrics 中间件测试
 */

import { afterEach, describe, expect, it } from "@dreamer/test";
import {
  getMetricsStats,
  metrics,
  resetMetrics,
} from "../../src/middleware/metrics.ts";
import { createTestContext } from "../helpers.ts";

describe("Metrics 中间件", () => {
  afterEach(() => {
    resetMetrics();
  });

  describe("基础功能", () => {
    it("应该创建 Metrics 中间件", () => {
      const middleware = metrics();
      expect(typeof middleware).toBe("function");
    });

    it("应该收集请求统计信息", async () => {
      const middleware = metrics();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(
        request,
        new Response("OK", { status: 200 }),
      );

      await middleware(context, async () => {});

      const stats = getMetricsStats();
      expect(stats.total).toBe(1);
      expect(stats.success).toBe(1);
    });

    it("应该统计成功请求（2xx）", async () => {
      const middleware = metrics();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(
        request,
        new Response("OK", { status: 200 }),
      );

      await middleware(context, async () => {});

      const stats = getMetricsStats();
      expect(stats.success).toBe(1);
      expect(stats.clientError).toBe(0);
      expect(stats.serverError).toBe(0);
    });

    it("应该统计客户端错误（4xx）", async () => {
      const middleware = metrics();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(
        request,
        new Response("Not Found", { status: 404 }),
      );

      await middleware(context, async () => {});

      const stats = getMetricsStats();
      expect(stats.success).toBe(0);
      expect(stats.clientError).toBe(1);
      expect(stats.serverError).toBe(0);
    });

    it("应该统计服务器错误（5xx）", async () => {
      const middleware = metrics();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(
        request,
        new Response("Internal Server Error", { status: 500 }),
      );

      await middleware(context, async () => {});

      const stats = getMetricsStats();
      expect(stats.success).toBe(0);
      expect(stats.clientError).toBe(0);
      expect(stats.serverError).toBe(1);
    });

    it("应该记录响应时间", async () => {
      const middleware = metrics();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(
        request,
        new Response("OK", { status: 200 }),
      );

      await middleware(context, async () => {
        // 模拟一些处理时间
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const stats = getMetricsStats();
      expect(stats.responseTime.total).toBeGreaterThan(0);
      expect(stats.responseTime.times.length).toBe(1);
    });

    it("应该按方法统计请求", async () => {
      const middleware = metrics();
      const getRequest = new Request("http://localhost:8000/api", {
        method: "GET",
      });
      const postRequest = new Request("http://localhost:8000/api", {
        method: "POST",
      });

      await middleware(
        createTestContext(getRequest, new Response("OK", { status: 200 })),
        async () => {},
      );
      await middleware(
        createTestContext(postRequest, new Response("OK", { status: 200 })),
        async () => {},
      );

      const stats = getMetricsStats();
      expect(stats.byMethod.get("GET")).toBe(1);
      expect(stats.byMethod.get("POST")).toBe(1);
    });

    it("应该按状态码统计请求", async () => {
      const middleware = metrics();
      const request1 = new Request("http://localhost:8000/api1");
      const request2 = new Request("http://localhost:8000/api2");

      await middleware(
        createTestContext(request1, new Response("OK", { status: 200 })),
        async () => {},
      );
      await middleware(
        createTestContext(request2, new Response("Not Found", { status: 404 })),
        async () => {},
      );

      const stats = getMetricsStats();
      expect(stats.byStatus.get(200)).toBe(1);
      expect(stats.byStatus.get(404)).toBe(1);
    });
  });

  describe("指标端点", () => {
    it("应该提供 /metrics 端点", async () => {
      const middleware = metrics();
      const request = new Request("http://localhost:8000/metrics", {
        method: "GET",
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(200);
      expect(context.response?.headers.get("Content-Type")).toBe(
        "text/plain; version=0.0.4",
      );
    });

    it("应该返回 Prometheus 格式的指标", async () => {
      const middleware = metrics();
      const request = new Request("http://localhost:8000/metrics", {
        method: "GET",
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const text = await context.response?.text();
      expect(text).toContain("http_requests_total");
      expect(text).toContain("http_request_duration_seconds");
    });

    it("应该支持自定义指标端点路径", async () => {
      const middleware = metrics({
        endpoint: "/prometheus",
      });
      const request = new Request("http://localhost:8000/prometheus", {
        method: "GET",
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(200);
    });

    it("应该只处理 GET 请求到指标端点", async () => {
      const middleware = metrics();
      const request = new Request("http://localhost:8000/metrics", {
        method: "POST",
      });
      const context = createTestContext(request);

      let nextCalled = false;
      await middleware(context, async () => {
        nextCalled = true;
      });

      // POST 请求应该继续到下一个中间件
      expect(nextCalled).toBe(true);
    });
  });

  describe("配置选项", () => {
    it("应该支持禁用指标收集", async () => {
      const middleware = metrics({
        enabled: false,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(
        request,
        new Response("OK", { status: 200 }),
      );

      await middleware(context, async () => {});

      const stats = getMetricsStats();
      expect(stats.total).toBe(0);
    });

    it("应该支持包含分位数", async () => {
      const middleware = metrics({
        includePercentiles: true,
      });
      const request = new Request("http://localhost:8000/metrics", {
        method: "GET",
      });
      const context = createTestContext(request);

      // 先发送一些请求以收集数据
      for (let i = 0; i < 10; i++) {
        await middleware(
          createTestContext(
            new Request("http://localhost:8000/api"),
            new Response("OK", { status: 200 }),
          ),
          async () => {},
        );
      }

      await middleware(context, async () => {});

      const text = await context.response?.text();
      expect(text).toContain('quantile="0.5"');
      expect(text).toContain('quantile="0.95"');
      expect(text).toContain('quantile="0.99"');
    });

    it("应该支持限制响应时间样本数", async () => {
      const middleware = metrics({
        maxSamples: 5,
      });
      const request = new Request("http://localhost:8000/api");

      // 发送超过 maxSamples 的请求
      for (let i = 0; i < 10; i++) {
        await middleware(
          createTestContext(request, new Response("OK", { status: 200 })),
          async () => {},
        );
      }

      const stats = getMetricsStats();
      expect(stats.responseTime.times.length).toBeLessThanOrEqual(5);
    });
  });

  describe("统计信息重置", () => {
    it("应该能够重置统计信息", async () => {
      const middleware = metrics();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(
        request,
        new Response("OK", { status: 200 }),
      );

      await middleware(context, async () => {});

      let stats = getMetricsStats();
      expect(stats.total).toBe(1);

      resetMetrics();

      stats = getMetricsStats();
      expect(stats.total).toBe(0);
      expect(stats.success).toBe(0);
      expect(stats.responseTime.times.length).toBe(0);
    });
  });

  describe("响应时间统计", () => {
    it("应该记录最小响应时间", async () => {
      const middleware = metrics();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(
        request,
        new Response("OK", { status: 200 }),
      );

      await middleware(context, async () => {});

      const stats = getMetricsStats();
      expect(stats.responseTime.min).toBeLessThanOrEqual(
        stats.responseTime.max,
      );
    });

    it("应该记录最大响应时间", async () => {
      const middleware = metrics();
      const request1 = new Request("http://localhost:8000/api1");
      const request2 = new Request("http://localhost:8000/api2");

      await middleware(
        createTestContext(request1, new Response("OK", { status: 200 })),
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
        },
      );
      await middleware(
        createTestContext(request2, new Response("OK", { status: 200 })),
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
        },
      );

      const stats = getMetricsStats();
      expect(stats.responseTime.max).toBeGreaterThanOrEqual(
        stats.responseTime.min,
      );
    });
  });
});
