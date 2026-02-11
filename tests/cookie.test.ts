/**
 * Cookie 管理测试
 */

import { describe, expect, it } from "@dreamer/test";
import { CookieManager, parseCookie, serializeCookie } from "../src/cookie.ts";
import type { CookieOptions } from "../src/context.ts";

describe("Cookie 管理", () => {
  describe("parseCookie", () => {
    it("应该解析简单的 cookie 字符串", () => {
      const cookies = parseCookie("name=value");
      expect(cookies).toEqual({ name: "value" });
    });

    it("应该解析多个 cookie", () => {
      const cookies = parseCookie("name1=value1; name2=value2");
      expect(cookies).toEqual({
        name1: "value1",
        name2: "value2",
      });
    });

    it("应该处理带空格的 cookie", () => {
      const cookies = parseCookie("name = value");
      expect(cookies).toEqual({ name: "value" });
    });

    it("应该处理 URL 编码的值", () => {
      const cookies = parseCookie("name=hello%20world");
      expect(cookies).toEqual({ name: "hello world" });
    });

    it("应该处理空字符串", () => {
      const cookies = parseCookie("");
      expect(cookies).toEqual({});
    });

    it("应该处理只有键没有值的 cookie", () => {
      const cookies = parseCookie("name=");
      expect(cookies).toEqual({ name: "" });
    });
  });

  describe("serializeCookie", () => {
    it("应该序列化简单的 cookie", () => {
      const cookie = serializeCookie("name", "value");
      expect(cookie).toBe("name=value");
    });

    it("应该序列化带选项的 cookie", () => {
      const cookie = serializeCookie("name", "value", {
        maxAge: 3600,
        path: "/",
        domain: "example.com",
        secure: true,
        httpOnly: true,
        sameSite: "strict",
      });
      expect(cookie).toContain("name=value");
      expect(cookie).toContain("Max-Age=3600");
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("Domain=example.com");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Strict");
    });

    it("应该处理 URL 编码的值", () => {
      const cookie = serializeCookie("name", "hello world");
      expect(cookie).toContain("hello%20world");
    });

    it("应该处理 SameSite=None", () => {
      const cookie = serializeCookie("name", "value", {
        sameSite: "none",
      });
      expect(cookie).toContain("SameSite=None");
    });

    it("应该处理 SameSite=Lax", () => {
      const cookie = serializeCookie("name", "value", {
        sameSite: "lax",
      });
      expect(cookie).toContain("SameSite=Lax");
    });
  });

  describe("CookieManager", () => {
    it("应该创建 CookieManager 实例", () => {
      const manager = new CookieManager("");
      expect(manager).toBeInstanceOf(CookieManager);
    });

    it("应该能够设置 cookie", () => {
      const manager = new CookieManager("");
      manager.set("name", "value");
      expect(manager.get("name")).toBe("value");
    });

    it("应该能够获取 cookie", () => {
      const manager = new CookieManager("");
      manager.set("name", "value");
      expect(manager.get("name")).toBe("value");
      expect(manager.get("nonexistent")).toBeUndefined();
    });

    it("应该能够删除 cookie", () => {
      const manager = new CookieManager("");
      manager.set("name", "value");
      manager.remove("name");
      expect(manager.get("name")).toBeUndefined();
    });

    it("应该能够获取所有 cookie", () => {
      const manager = new CookieManager("");
      manager.set("name1", "value1");
      manager.set("name2", "value2");
      const all = manager.getAll();
      expect(all).toEqual({
        name1: "value1",
        name2: "value2",
      });
    });

    it("应该能够设置带选项的 cookie", () => {
      const manager = new CookieManager("");
      const options: CookieOptions = {
        maxAge: 3600,
        path: "/",
        secure: true,
      };
      manager.set("name", "value", options);
      expect(manager.get("name")).toBe("value");
    });

    it("应该能够应用到响应头", () => {
      const manager = new CookieManager("");
      manager.set("name1", "value1");
      manager.set("name2", "value2", { maxAge: 3600 });
      const response = new Response("OK");
      const newResponse = manager.applyToResponse(response);
      const setCookieHeaders = newResponse.headers.getSetCookie();
      expect(setCookieHeaders.length).toBeGreaterThan(0);
      expect(setCookieHeaders.some((h: string) => h.includes("name1=value1")))
        .toBe(true);
      expect(setCookieHeaders.some((h: string) => h.includes("name2=value2")))
        .toBe(true);
    });

    it("应该能够从请求头解析 cookie", () => {
      const manager = new CookieManager("name1=value1; name2=value2");
      expect(manager.get("name1")).toBe("value1");
      expect(manager.get("name2")).toBe("value2");
    });
  });
});
