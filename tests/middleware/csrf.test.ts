/**
 * CSRF 保护中间件测试
 */

import { afterEach, describe, expect, it } from "@dreamer/test";
import { csrf } from "../../src/middleware/csrf.ts";
import { createTestContext } from "../helpers.ts";

describe("CSRF 保护中间件", () => {
  afterEach(() => {
    // 清理测试
  });

  describe("基础功能", () => {
    it("应该创建 CSRF 保护中间件", () => {
      const middleware = csrf();
      expect(typeof middleware).toBe("function");
    });

    it("应该为 GET 请求生成 CSRF Token", async () => {
      const middleware = csrf();
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const token = context.cookies.get("_csrf");
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token!.length).toBeGreaterThan(0);
    });

    it("应该跳过安全方法（GET、HEAD、OPTIONS）", async () => {
      const middleware = csrf();
      const getRequest = new Request("http://localhost:8000/api", {
        method: "GET",
      });
      const getContext = createTestContext(getRequest);

      await middleware(getContext, async () => {
        getContext.response = new Response("OK", { status: 200 });
      });

      // GET 请求应该通过，不需要验证 Token，但会生成 Token
      expect(getContext.response?.status).toBe(200);
      const token = getContext.cookies.get("_csrf");
      expect(token).toBeDefined(); // Token 应该被生成

      const headRequest = new Request("http://localhost:8000/api", {
        method: "HEAD",
      });
      const headContext = createTestContext(headRequest);

      await middleware(headContext, async () => {
        headContext.response = new Response(null, { status: 200 });
      });

      expect(headContext.response?.status).toBe(200);
    });

    it("应该验证 POST 请求的 CSRF Token", async () => {
      const middleware = csrf();
      const request = new Request("http://localhost:8000/api", {
        method: "POST",
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      // 没有 Token，应该返回 403
      expect(context.response?.status).toBe(403);
      const text = await context.response?.text();
      expect(text).toContain("CSRF token mismatch");
    });

    it("应该接受有效的 CSRF Token（从请求头）", async () => {
      const middleware = csrf();
      const token = "test-csrf-token-123";

      // 先设置 Cookie
      const getRequest = new Request("http://localhost:8000/api", {
        method: "GET",
      });
      const getContext = createTestContext(getRequest);
      getContext.cookies.set("_csrf", token);

      await middleware(getContext, async () => {});

      // 然后使用 Token 发送 POST 请求
      const postRequest = new Request("http://localhost:8000/api", {
        method: "POST",
        headers: { "X-CSRF-Token": token },
      });
      const postContext = createTestContext(postRequest);
      postContext.cookies.set("_csrf", token);

      await middleware(postContext, async () => {
        postContext.response = new Response("OK", { status: 200 });
      });

      expect(postContext.response?.status).toBe(200);
    });

    it("应该接受有效的 CSRF Token（从表单字段）", async () => {
      const middleware = csrf();
      const token = "test-csrf-token-456";

      const postRequest = new Request("http://localhost:8000/api", {
        method: "POST",
      });
      const postContext = createTestContext(postRequest);
      postContext.cookies.set("_csrf", token);
      postContext.body = { _csrf: token };

      await middleware(postContext, async () => {
        postContext.response = new Response("OK", { status: 200 });
      });

      expect(postContext.response?.status).toBe(200);
    });

    it("应该拒绝无效的 CSRF Token", async () => {
      const middleware = csrf();
      const cookieToken = "cookie-token-123";
      const requestToken = "different-token-456";

      const postRequest = new Request("http://localhost:8000/api", {
        method: "POST",
        headers: { "X-CSRF-Token": requestToken },
      });
      const postContext = createTestContext(postRequest);
      postContext.cookies.set("_csrf", cookieToken);

      await middleware(postContext, async () => {});

      expect(postContext.response?.status).toBe(403);
      const text = await postContext.response?.text();
      expect(text).toContain("CSRF token mismatch");
    });
  });

  describe("配置选项", () => {
    it("应该支持自定义 Cookie 名称", async () => {
      const middleware = csrf({ cookieName: "custom-csrf" });
      const request = new Request("http://localhost:8000/api");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const token = context.cookies.get("custom-csrf");
      expect(token).toBeDefined();
    });

    it("应该支持自定义请求头名称", async () => {
      const middleware = csrf({ headerName: "X-Custom-CSRF" });
      const token = "test-token";

      const postRequest = new Request("http://localhost:8000/api", {
        method: "POST",
        headers: { "X-Custom-CSRF": token },
      });
      const postContext = createTestContext(postRequest);
      postContext.cookies.set("_csrf", token);

      await middleware(postContext, async () => {
        postContext.response = new Response("OK", { status: 200 });
      });

      expect(postContext.response?.status).toBe(200);
    });

    it("应该支持自定义表单字段名称", async () => {
      const middleware = csrf({ fieldName: "custom_csrf" });
      const token = "test-token";

      const postRequest = new Request("http://localhost:8000/api", {
        method: "POST",
      });
      const postContext = createTestContext(postRequest);
      postContext.cookies.set("_csrf", token);
      postContext.body = { custom_csrf: token };

      await middleware(postContext, async () => {
        postContext.response = new Response("OK", { status: 200 });
      });

      expect(postContext.response?.status).toBe(200);
    });

    it("应该支持自定义 Token 生成函数", async () => {
      const customToken = "custom-generated-token";
      const middleware = csrf({
        tokenGenerator: () => customToken,
      });
      const request = new Request("http://localhost:8000/api", {
        method: "GET",
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      // 从 CookieManager 获取 token（因为中间件会设置）
      const allCookies = context.cookies.getAll();
      const token = allCookies["_csrf"] || context.cookies.get("_csrf");
      expect(token).toBe(customToken);
    });

    it("应该支持自定义 shouldSkip 函数", async () => {
      const middleware = csrf({
        shouldSkip: (ctx) => ctx.path.startsWith("/api/public"),
      });
      const request = new Request("http://localhost:8000/api/public/data");
      const context = createTestContext(request);

      await middleware(context, async () => {
        context.response = new Response("OK", { status: 200 });
      });

      // 应该跳过验证
      expect(context.response?.status).toBe(200);
    });

    it("应该支持自定义 shouldVerify 函数", async () => {
      const middleware = csrf({
        shouldVerify: (ctx) => ctx.method === "DELETE",
      });
      const token = "test-token";

      // POST 请求不应该验证
      const postRequest = new Request("http://localhost:8000/api", {
        method: "POST",
      });
      const postContext = createTestContext(postRequest);
      postContext.cookies.set("_csrf", token);

      await middleware(postContext, async () => {
        postContext.response = new Response("OK", { status: 200 });
      });

      expect(postContext.response?.status).toBe(200);

      // DELETE 请求应该验证
      const deleteRequest = new Request("http://localhost:8000/api", {
        method: "DELETE",
      });
      const deleteContext = createTestContext(deleteRequest);
      deleteContext.cookies.set("_csrf", token);

      await middleware(deleteContext, async () => {});

      expect(deleteContext.response?.status).toBe(403);
    });

    it("应该支持自定义错误消息", async () => {
      const customMessage = "Custom CSRF error message";
      const middleware = csrf({ errorMessage: customMessage });
      const request = new Request("http://localhost:8000/api", {
        method: "POST",
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const text = await context.response?.text();
      expect(text).toContain(customMessage);
    });
  });

  describe("Cookie 选项", () => {
    it("应该支持自定义 Cookie 选项", async () => {
      const middleware = csrf({
        cookieOptions: {
          secure: false,
          httpOnly: false,
          sameSite: "lax",
          path: "/api",
        },
      });
      const request = new Request("http://localhost:8000/api", {
        method: "GET",
      });
      const context = createTestContext(request);

      await middleware(context, async () => {});

      // Cookie 应该被设置（通过 CookieManager）
      const allCookies = context.cookies.getAll();
      const token = allCookies["_csrf"] || context.cookies.get("_csrf");
      expect(token).toBeDefined();
    });
  });
});
