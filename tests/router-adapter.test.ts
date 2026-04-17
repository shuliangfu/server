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

    it("API 处理器仅接收 ApiRouteContext（含 req、res、url、params）", async () => {
      let received: unknown;
      const mockRouter = {
        match: async (path: string) => {
          if (path === "/api/demo") {
            return {
              handlers: {
                GET: async (ctx: Record<string, unknown>) => {
                  received = ctx;
                  return (ctx.res as { json: (d: unknown) => Response })
                    .json({
                      ok: true,
                    });
                },
              },
              params: {},
              isApi: true,
            };
          }
          return null;
        },
        getApiMode: () => "restful" as const,
      } as unknown as Router;

      const adapter = new RouterAdapter(mockRouter);
      const request = new Request("http://localhost:8000/api/demo");
      const context = createTestContext(request);
      await adapter.handle(context);

      expect(received).toBeDefined();
      const c = received as {
        url: string;
        req: Request;
        params: Record<string, string>;
        query: Record<string, string>;
        res: { json: (d: unknown) => Response };
      };
      expect(c.url).toContain("/api/demo");
      expect(c.req).toBeInstanceOf(Request);
      expect(typeof c.res?.json).toBe("function");
    });

    it("apiMode action：params.action 指向 login", async () => {
      const mockRouter = {
        match: async (path: string) => {
          if (path === "/api/auth/login") {
            return {
              handlers: {
                login: async () => new Response("LOGIN_OK"),
              },
              params: { action: "login" },
              isApi: true,
            };
          }
          return null;
        },
        getApiMode: () => "action" as const,
      } as unknown as Router;

      const adapter = new RouterAdapter(mockRouter);
      const request = new Request("http://localhost:8000/api/auth/login", {
        method: "POST",
      });
      const context = createTestContext(request);
      const handled = await adapter.handle(context);

      expect(handled).toBe(true);
      expect(await context.response!.text()).toBe("LOGIN_OK");
    });

    it("apiMode action：路径末段 kebab 匹配 testConnection", async () => {
      const mockRouter = {
        match: async (path: string) => {
          if (path === "/api/credentials/test-connection") {
            return {
              handlers: {
                testConnection: async () => new Response("TC_OK"),
              },
              params: {},
              isApi: true,
            };
          }
          return null;
        },
        getApiMode: () => "action" as const,
      } as unknown as Router;

      const adapter = new RouterAdapter(mockRouter);
      const request = new Request(
        "http://localhost:8000/api/credentials/test-connection",
        { method: "POST" },
      );
      const context = createTestContext(request);
      const handled = await adapter.handle(context);

      expect(handled).toBe(true);
      expect(await context.response!.text()).toBe("TC_OK");
    });

    it("restful 仍优先 HTTP 动词", async () => {
      const mockRouter = {
        match: async (path: string) => {
          if (path === "/api/x") {
            return {
              handlers: {
                POST: async () => new Response("REST_POST"),
              },
              params: {},
              isApi: true,
            };
          }
          return null;
        },
        getApiMode: () => "restful" as const,
      } as unknown as Router;

      const adapter = new RouterAdapter(mockRouter);
      const request = new Request("http://localhost:8000/api/x", {
        method: "POST",
      });
      const context = createTestContext(request);
      await adapter.handle(context);
      expect(await context.response!.text()).toBe("REST_POST");
    });

    it("POST application/json 时预解析并注入 apiCtx.body", async () => {
      let received: unknown;
      const mockRouter = {
        match: async (path: string) => {
          if (path === "/api/body") {
            return {
              handlers: {
                POST: async (ctx: Record<string, unknown>) => {
                  received = ctx;
                  return (ctx.res as { json: (d: unknown) => Response }).json({
                    echo: ctx.body,
                  });
                },
              },
              params: {},
              isApi: true,
            };
          }
          return null;
        },
        getApiMode: () => "restful" as const,
      } as unknown as Router;

      const adapter = new RouterAdapter(mockRouter);
      const request = new Request("http://localhost:8000/api/body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: 1 }),
      });
      const context = createTestContext(request);
      await adapter.handle(context);

      const c = received as { body?: unknown };
      expect(c.body).toEqual({ a: 1 });
      const json = await context.response!.json() as { echo: unknown };
      expect(json.echo).toEqual({ a: 1 });
    });
  });
});
