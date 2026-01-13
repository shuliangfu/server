/**
 * 响应缓存中间件测试
 */

import { afterEach, describe, expect, it } from "@dreamer/test";
import type { HttpContext } from "../../src/context.ts";
import {
  clearResponseCache,
  getResponseCacheStats,
  responseCache,
} from "../../src/middleware/response-cache.ts";
import { createTestContext } from "../helpers.ts";

describe("Response Cache 中间件", () => {
  // 每个测试后清空缓存
  afterEach(() => {
    clearResponseCache();
  });

  describe("基础功能", () => {
    it("应该创建响应缓存中间件", () => {
      const middleware = responseCache();
      expect(typeof middleware).toBe("function");
    });

    it("应该缓存 GET 请求的响应", async () => {
      const middleware = responseCache();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      // 第一次请求，应该缓存
      await middleware(context, async () => {
        context.response = new Response("Cached Response", { status: 200 });
      });

      expect(context.response?.status).toBe(200);
      expect(context.response?.headers.get("X-Cache")).toBe("MISS");
      const firstBody = await context.response?.text();

      // 第二次请求，应该从缓存获取
      const context2 = createTestContext(request);
      await middleware(context2, async () => {
        context2.response = new Response("New Response", { status: 200 });
      });

      expect(context2.response?.status).toBe(200);
      expect(context2.response?.headers.get("X-Cache")).toBe("HIT");
      const secondBody = await context2.response?.text();
      expect(secondBody).toBe(firstBody);
    });

    it("应该跳过非 GET/HEAD 请求", async () => {
      const middleware = responseCache();
      const request = new Request("http://localhost:8000/api", {
        method: "POST",
      });
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("POST Response", { status: 200 });
      });

      expect(context.response?.status).toBe(200);
      expect(context.response?.headers.get("X-Cache")).toBe("SKIP");
      expect(context.response?.headers.get("Cache-Control")).toBe(
        "no-cache, no-store, must-revalidate",
      );
    });

    it("应该只缓存成功的响应（2xx）", async () => {
      const middleware = responseCache();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      // 404 响应不应该被缓存
      await middleware(context, async () => {
        context.response = new Response("Not Found", { status: 404 });
      });

      expect(context.response?.status).toBe(404);
      expect(context.response?.headers.get("X-Cache")).toBe("SKIP");

      // 500 响应不应该被缓存
      const context2 = createTestContext(request);
      await middleware(context2, async () => {
        context2.response = new Response("Server Error", { status: 500 });
      });

      expect(context2.response?.status).toBe(500);
      expect(context2.response?.headers.get("X-Cache")).toBe("SKIP");
    });
  });

  describe("ETag 支持", () => {
    it("应该生成 ETag", async () => {
      const middleware = responseCache({ etag: true });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("Test Response", { status: 200 });
      });

      expect(context.response?.headers.get("ETag")).toBeDefined();
      const etag = context.response?.headers.get("ETag");
      expect(etag).toMatch(/^".*"$/); // ETag 应该用引号包裹
    });

    it("应该支持 If-None-Match 条件请求", async () => {
      const middleware = responseCache({ etag: true });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      // 第一次请求，获取 ETag
      await middleware(context, async () => {
        context.response = new Response("Test Response", { status: 200 });
      });

      const etag = context.response?.headers.get("ETag");
      expect(etag).toBeDefined();

      // 第二次请求，使用 If-None-Match
      const request2 = new Request("http://localhost:8000/api", {
        headers: { "If-None-Match": etag! },
      });
      const context2 = createTestContext(request2);

      await middleware(context2, async () => {
        context2.response = new Response("Test Response", { status: 200 });
      });

      expect(context2.response?.status).toBe(304); // Not Modified
    });

    it("应该支持禁用 ETag", async () => {
      const middleware = responseCache({ etag: false });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("Test Response", { status: 200 });
      });

      expect(context.response?.headers.get("ETag")).toBeNull();
    });
  });

  describe("Last-Modified 支持", () => {
    it("应该生成 Last-Modified", async () => {
      const middleware = responseCache({ lastModified: true });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("Test Response", { status: 200 });
      });

      expect(context.response?.headers.get("Last-Modified")).toBeDefined();
    });

    it("应该支持 If-Modified-Since 条件请求", async () => {
      // 禁用 ETag，只测试 Last-Modified
      const middleware = responseCache({
        lastModified: true,
        etag: false,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      // 第一次请求，获取 Last-Modified
      await middleware(context, async () => {
        context.response = new Response("Test Response", { status: 200 });
      });

      const lastModified = context.response?.headers.get("Last-Modified");
      expect(lastModified).toBeDefined();

      // 等待一小段时间，确保时间戳不同
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 第二次请求，使用 If-Modified-Since（使用未来的时间）
      const futureDate = new Date(Date.now() + 10000).toUTCString();
      const request2 = new Request("http://localhost:8000/api", {
        headers: { "If-Modified-Since": futureDate },
      });
      const context2 = createTestContext(request2);

      await middleware(context2, async () => {
        context2.response = new Response("Test Response", { status: 200 });
      });

      expect(context2.response?.status).toBe(304); // Not Modified
    });

    it("应该支持禁用 Last-Modified", async () => {
      const middleware = responseCache({ lastModified: false });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("Test Response", { status: 200 });
      });

      expect(context.response?.headers.get("Last-Modified")).toBeNull();
    });
  });

  describe("缓存策略", () => {
    it("应该支持 public 缓存策略", async () => {
      const middleware = responseCache({
        cacheControl: "public",
        maxAge: 3600,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("Test Response", { status: 200 });
      });

      expect(context.response?.headers.get("Cache-Control")).toBe(
        "public, max-age=3600",
      );
    });

    it("应该支持 private 缓存策略", async () => {
      const middleware = responseCache({
        cacheControl: "private",
        maxAge: 1800,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("Test Response", { status: 200 });
      });

      expect(context.response?.headers.get("Cache-Control")).toBe(
        "private, max-age=1800",
      );
    });

    it("应该支持 no-cache 缓存策略", async () => {
      const middleware = responseCache({
        cacheControl: "no-cache",
        maxAge: 600,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("Test Response", { status: 200 });
      });

      expect(context.response?.headers.get("Cache-Control")).toBe(
        "no-cache, max-age=600",
      );
    });
  });

  describe("缓存键生成", () => {
    it("应该基于 URL 生成缓存键", async () => {
      const middleware = responseCache();
      const request1 = new Request("http://localhost:8000/api/users");
      const context1 = createTestContext(request1);

      await middleware(context1, async () => {
        context1.response = new Response("Users", { status: 200 });
      });

      const request2 = new Request("http://localhost:8000/api/posts");
      const context2 = createTestContext(request2);

      await middleware(context2, async () => {
        context2.response = new Response("Posts", { status: 200 });
      });

      // 不同的 URL 应该有不同的缓存
      expect(context1.response?.headers.get("X-Cache")).toBe("MISS");
      expect(context2.response?.headers.get("X-Cache")).toBe("MISS");
    });

    it("应该基于查询参数生成缓存键", async () => {
      const middleware = responseCache();
      const request1 = new Request("http://localhost:8000/api?page=1");
      const context1 = createTestContext(request1);
      context1.query = { page: "1" };

      await middleware(context1, async () => {
        context1.response = new Response("Page 1", { status: 200 });
      });

      const request2 = new Request("http://localhost:8000/api?page=2");
      const context2 = createTestContext(request2);
      context2.query = { page: "2" };

      await middleware(context2, async () => {
        context2.response = new Response("Page 2", { status: 200 });
      });

      // 不同的查询参数应该有不同的缓存
      expect(context1.response?.headers.get("X-Cache")).toBe("MISS");
      expect(context2.response?.headers.get("X-Cache")).toBe("MISS");
    });

    it("应该支持自定义缓存键生成函数", async () => {
      const customKeyGenerator = (ctx: HttpContext) => {
        return `custom:${ctx.path}`;
      };

      const middleware = responseCache({
        keyGenerator: customKeyGenerator,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("Test", { status: 200 });
      });

      // 应该使用自定义键生成函数
      expect(context.response?.headers.get("X-Cache")).toBe("MISS");
    });
  });

  describe("缓存配置", () => {
    it("应该支持自定义 shouldCache 函数", async () => {
      const middleware = responseCache({
        shouldCache: (ctx, response) => {
          // 只缓存 201 响应
          return response.status === 201;
        },
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      // 200 响应不应该被缓存
      await middleware(context, async () => {
        context.response = new Response("Created", { status: 200 });
      });

      expect(context.response?.headers.get("X-Cache")).toBe("SKIP");

      // 201 响应应该被缓存
      const context2 = createTestContext(request);
      await middleware(context2, async () => {
        context2.response = new Response("Created", { status: 201 });
      });

      expect(context2.response?.headers.get("X-Cache")).toBe("MISS");
    });

    it("应该支持自定义 shouldSkip 函数", async () => {
      const middleware = responseCache({
        shouldSkip: (ctx) => {
          // 跳过 /api/admin 路径
          return ctx.path.startsWith("/api/admin");
        },
      });
      const request = new Request("http://localhost:8000/api/admin");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("Admin", { status: 200 });
      });

      expect(context.response?.headers.get("X-Cache")).toBe("SKIP");
    });
  });

  describe("缓存统计", () => {
    it("应该提供缓存统计信息", () => {
      const stats = getResponseCacheStats();
      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("count");
      expect(stats).toHaveProperty("maxSize");
      expect(stats).toHaveProperty("usage");
    });

    it("应该能够清空缓存", async () => {
      const middleware = responseCache();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      // 缓存一个响应
      await middleware(context, async () => {
        context.response = new Response("Cached", { status: 200 });
      });

      // 清空缓存
      clearResponseCache();

      // 再次请求应该缓存未命中
      const context2 = createTestContext(request);
      await middleware(context2, async () => {
        context2.response = new Response("New", { status: 200 });
      });

      expect(context2.response?.headers.get("X-Cache")).toBe("MISS");
    });
  });
});
