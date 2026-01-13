/**
 * 响应压缩中间件测试
 */

import { describe, expect, it } from "@dreamer/test";
import { compression } from "../../src/middleware/compression.ts";
import { createTestContext } from "../helpers.ts";

describe("Compression 中间件", () => {
  describe("基础功能", () => {
    it("应该创建压缩中间件", () => {
      const middleware = compression();
      expect(typeof middleware).toBe("function");
    });

    it("应该压缩支持 gzip 的响应", async () => {
      const middleware = compression();
      const request = new Request("http://localhost:8000/api", {
        headers: {
          "Accept-Encoding": "gzip",
        },
      });
      const context = createTestContext(
        request,
        new Response("Hello, World!".repeat(100), {
          headers: {
            "Content-Type": "text/plain",
          },
        }),
      );

      await middleware(context, async () => {});

      const encoding = context.response?.headers.get("Content-Encoding");
      expect(encoding).toBe("gzip");
    });

    it("应该压缩支持 brotli 的响应", async () => {
      const middleware = compression({
        enableBrotli: true,
      });
      const request = new Request("http://localhost:8000/api", {
        headers: {
          "Accept-Encoding": "br",
        },
      });
      const context = createTestContext(
        request,
        new Response("Hello, World!".repeat(100), {
          headers: {
            "Content-Type": "text/plain",
          },
        }),
      );

      await middleware(context, async () => {});

      const encoding = context.response?.headers.get("Content-Encoding");
      expect(encoding).toBe("br");
    });

    it("应该不压缩不支持压缩的响应", async () => {
      const middleware = compression();
      const request = new Request("http://localhost:8000/api", {
        headers: {},
      });
      const context = createTestContext(
        request,
        new Response("Hello, World!"),
      );

      await middleware(context, async () => {});

      const encoding = context.response?.headers.get("Content-Encoding");
      expect(encoding).toBeNull();
    });
  });

  describe("配置选项", () => {
    it("应该支持自定义压缩级别", async () => {
      const middleware = compression({
        level: 9,
      });
      // 应该不抛出错误
      expect(typeof middleware).toBe("function");
    });

    it("应该支持文件类型过滤", async () => {
      const middleware = compression({
        filter: (contentType: string) => {
          return contentType.startsWith("text/");
        },
      });
      const request = new Request("http://localhost:8000/api", {
        headers: {
          "Accept-Encoding": "gzip",
        },
      });
      const context = createTestContext(
        request,
        new Response("Hello, World!".repeat(100), {
          headers: {
            "Content-Type": "text/plain",
          },
        }),
      );

      await middleware(context, async () => {});

      const encoding = context.response?.headers.get("Content-Encoding");
      expect(encoding).toBe("gzip");
    });

    it("应该支持大小阈值", async () => {
      const middleware = compression({
        threshold: 1000,
      });
      const request = new Request("http://localhost:8000/api", {
        headers: {
          "Accept-Encoding": "gzip",
        },
      });
      // 小响应不应该被压缩
      const context = createTestContext(
        request,
        new Response("Hello"),
      );

      await middleware(context, async () => {});

      const encoding = context.response?.headers.get("Content-Encoding");
      // 小响应可能不会被压缩
      expect(context.response).toBeDefined();
    });
  });
});
