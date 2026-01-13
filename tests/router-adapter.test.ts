/**
 * 路由适配器测试
 */

import { describe, expect, it } from "@dreamer/test";
import { RouterAdapter } from "../src/router-adapter.ts";
import type { Router } from "@dreamer/router";
import { createTestContext } from "./helpers.ts";

describe("RouterAdapter", () => {
  describe("构造函数", () => {
    it("应该创建 RouterAdapter 实例", () => {
      const mockRouter = {
        match: async () => null,
      } as unknown as Router;
      const adapter = new RouterAdapter(mockRouter);
      expect(adapter).toBeInstanceOf(RouterAdapter);
    });
  });

  describe("路由匹配", () => {
    it("应该能够匹配路由", async () => {
      const mockRouter = {
        match: async (path: string) => {
          if (path === "/test") {
            return {
              handlers: { GET: async () => new Response("OK") },
              params: {},
              isApi: true,
            };
          }
          return null;
        },
      } as unknown as Router;

      const adapter = new RouterAdapter(mockRouter);
      const request = new Request("http://localhost:8000/test");
      const context = createTestContext(request);
      const handled = await adapter.handle(context);

      expect(handled).toBe(true);
      expect(context.response).toBeDefined();
    });

    it("应该返回 null 当路由不匹配", async () => {
      const mockRouter = {
        match: async () => null,
      } as unknown as Router;

      const adapter = new RouterAdapter(mockRouter);
      const request = new Request("http://localhost:8000/notfound");
      const context = createTestContext(request);
      const handled = await adapter.handle(context);

      expect(handled).toBe(false);
    });

    it("应该能够处理动态路由参数", async () => {
      const mockRouter = {
        match: async (path: string) => {
          if (path.startsWith("/user/")) {
            const id = path.split("/")[2];
            return {
              handlers: { GET: async () => new Response(`User ${id}`) },
              params: { id },
              isApi: true,
            };
          }
          return null;
        },
      } as unknown as Router;

      const adapter = new RouterAdapter(mockRouter);
      const request = new Request("http://localhost:8000/user/123");
      const context = createTestContext(request);
      const handled = await adapter.handle(context);

      expect(handled).toBe(true);
      expect(context.params).toEqual({ id: "123" });
    });
  });
});
