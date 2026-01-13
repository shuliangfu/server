/**
 * HTTP 上下文测试
 */

import { describe, expect, it } from "@dreamer/test";
import { CookieManager } from "../src/cookie.ts";
import type { HttpContext, HttpError } from "../src/context.ts";

describe("HTTP 上下文", () => {
  describe("HttpContext 类型", () => {
    it("应该能够创建 HttpContext 对象", () => {
      const request = new Request("http://localhost:8000/");
      const url = new URL(request.url);
      const context: HttpContext = {
        request,
        response: new Response(),
        state: {},
        cookies: new CookieManager(request.headers.get("Cookie") || ""),
        path: url.pathname,
        method: request.method,
        url,
        headers: request.headers,
      };
      expect(context.request).toBeInstanceOf(Request);
      expect(context.response).toBeInstanceOf(Response);
      expect(context.state).toBeInstanceOf(Object);
      expect(context.cookies).toBeInstanceOf(CookieManager);
    });

    it("应该支持自定义状态", () => {
      const request = new Request("http://localhost:8000/");
      const url = new URL(request.url);
      const context: HttpContext = {
        request,
        response: new Response(),
        state: {
          user: { id: 1, name: "test" },
        },
        cookies: new CookieManager(request.headers.get("Cookie") || ""),
        path: url.pathname,
        method: request.method,
        url,
        headers: request.headers,
      };
      expect((context.state as any).user).toEqual({ id: 1, name: "test" });
    });

    it("应该支持 cookies", () => {
      const request = new Request("http://localhost:8000/");
      const url = new URL(request.url);
      const cookieManager = new CookieManager("session=abc123");
      const context: HttpContext = {
        request,
        response: new Response(),
        state: {},
        cookies: cookieManager,
        path: url.pathname,
        method: request.method,
        url,
        headers: request.headers,
      };
      expect(context.cookies.get("session")).toBe("abc123");
    });
  });

  describe("HttpError 类型", () => {
    it("应该能够创建 HttpError 对象", () => {
      const error: HttpError = {
        message: "Test error",
        status: 500,
      };
      expect(error.message).toBe("Test error");
      expect(error.status).toBe(500);
    });

    it("应该支持可选的 code 字段", () => {
      const error: HttpError = {
        message: "Test error",
        status: 500,
        code: "INTERNAL_ERROR",
      };
      expect(error.code).toBe("INTERNAL_ERROR");
    });

    it("应该支持可选的 cause 字段", () => {
      const cause = new Error("Original error");
      const error: HttpError = {
        message: "Wrapped error",
        status: 500,
        cause,
      };
      expect(error.cause).toBe(cause);
    });
  });
});
