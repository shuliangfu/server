/**
 * Request ID 中间件测试
 */

import { describe, expect, it } from "@dreamer/test";
import { requestId as createRequestIdMiddleware } from "../../src/middleware/request-id.ts";
import { createTestContext } from "../helpers.ts";

describe("Request ID 中间件", () => {
  describe("基础功能", () => {
    it("应该创建 Request ID 中间件", () => {
      const middleware = createRequestIdMiddleware();
      expect(typeof middleware).toBe("function");
    });

    it("应该为请求生成 Request ID", async () => {
      const middleware = createRequestIdMiddleware();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const id = context.response?.headers.get("X-Request-ID");
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
      expect(id!.length).toBeGreaterThan(0);
    });

    it("应该将 Request ID 添加到响应头", async () => {
      const middleware = createRequestIdMiddleware();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const id = context.response?.headers.get("X-Request-ID");
      expect(id).toBeDefined();
    });

    it("应该将 Request ID 存储到 context 中", async () => {
      const middleware = createRequestIdMiddleware();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const id = (context as any).requestId;
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
    });

    it("应该使用请求头中的 Request ID（如果存在）", async () => {
      const existingId = "existing-request-id-12345";
      const middleware = createRequestIdMiddleware({
        readFromHeader: true,
      });
      const request = new Request("http://localhost:8000/api", {
        headers: {
          "X-Request-ID": existingId,
        },
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const id = context.response?.headers.get("X-Request-ID");
      expect(id).toBe(existingId);
      expect((context as any).requestId).toBe(existingId);
    });

    it("应该生成新的 Request ID（如果请求头中没有）", async () => {
      const middleware = createRequestIdMiddleware({
        readFromHeader: true,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const id = context.response?.headers.get("X-Request-ID");
      expect(id).toBeDefined();
      expect(id).not.toBe("existing-request-id-12345");
    });
  });

  describe("配置选项", () => {
    it("应该支持自定义请求头名称", async () => {
      const middleware = createRequestIdMiddleware({
        headerName: "X-Correlation-ID",
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const correlationId = context.response?.headers.get("X-Correlation-ID");
      expect(correlationId).toBeDefined();
      expect(context.response?.headers.get("X-Request-ID")).toBeNull();
    });

    it("应该支持禁用响应头中的 Request ID", async () => {
      const middleware = createRequestIdMiddleware({
        includeInResponse: false,
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const id = context.response?.headers.get("X-Request-ID");
      expect(id).toBeNull();
      // 但 context 中仍然应该有 Request ID
      expect((context as any).requestId).toBeDefined();
    });

    it("应该支持自定义 ID 生成函数", async () => {
      let callCount = 0;
      const middleware = createRequestIdMiddleware({
        generateId: () => {
          callCount++;
          return `custom-id-${callCount}`;
        },
      });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const id = context.response?.headers.get("X-Request-ID");
      expect(id).toBe("custom-id-1");
      expect(callCount).toBe(1);
    });

    it("应该支持禁用从请求头读取", async () => {
      const existingId = "existing-request-id-12345";
      const middleware = createRequestIdMiddleware({
        readFromHeader: false,
      });
      const request = new Request("http://localhost:8000/api", {
        headers: {
          "X-Request-ID": existingId,
        },
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const id = context.response?.headers.get("X-Request-ID");
      expect(id).toBeDefined();
      expect(id).not.toBe(existingId);
    });
  });

  describe("多个请求", () => {
    it("应该为每个请求生成不同的 Request ID", async () => {
      const middleware = createRequestIdMiddleware();
      const request1 = new Request("http://localhost:8000/api1");
      const request2 = new Request("http://localhost:8000/api2");
      const context1 = createTestContext(request1);
      const context2 = createTestContext(request2);

      await middleware(context1, async () => {});
      await middleware(context2, async () => {});

      const id1 = context1.response?.headers.get("X-Request-ID");
      const id2 = context2.response?.headers.get("X-Request-ID");
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });
  });
});
