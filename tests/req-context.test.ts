/**
 * `context.ts` 内：请求推导字段与 `buildApiRouteContext` 扩展字段测试
 */

import { describe, expect, it } from "@dreamer/test";
import {
  buildApiRouteContext,
  pathnameFromHref,
  resolveClientIp,
  resolveRequestId,
  searchFromHref,
  snapshotMatchedRoute,
} from "../src/mod.ts";
import { createTestContext } from "./helpers.ts";

describe("req-context", () => {
  describe("pathnameFromHref()", () => {
    it("去掉 pathname 尾 /", () => {
      expect(pathnameFromHref("https://x.test/foo/")).toBe("/foo");
      expect(pathnameFromHref("/bar/baz?z=1")).toBe("/bar/baz");
    });
  });

  describe("searchFromHref()", () => {
    it("返回含 ? 的 search 段", () => {
      expect(searchFromHref("https://x.test/a?p=1")).toBe("?p=1");
      expect(searchFromHref("/only")).toBe("");
    });
  });

  describe("resolveRequestId()", () => {
    it("优先使用请求头中的 ID", () => {
      const h = new Headers({ "x-request-id": "upstream-id" });
      expect(resolveRequestId(h)).toBe("upstream-id");
      const h2 = new Headers({ "x-correlation-id": "corr-1" });
      expect(resolveRequestId(h2)).toBe("corr-1");
    });

    it("无头时生成 UUID 形状字符串", () => {
      const id = resolveRequestId(new Headers());
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe("resolveClientIp()", () => {
    it("x-forwarded-for 取首段", () => {
      const h = new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" });
      expect(resolveClientIp(h)).toBe("1.1.1.1");
    });
  });

  describe("snapshotMatchedRoute()", () => {
    it("复制四元组", () => {
      const s = snapshotMatchedRoute({
        path: "/a",
        file: "a.ts",
        fullPath: "/p/a.ts",
        isApi: true,
      });
      expect(s).toEqual({
        path: "/a",
        file: "a.ts",
        fullPath: "/p/a.ts",
        isApi: true,
      });
    });
  });
});

describe("buildApiRouteContext() 扩展", () => {
  it("含 pathname、search、requestId、matchedRoute", () => {
    const req = new Request("http://localhost:3000/api/hi?k=1", {
      method: "GET",
      headers: {
        "x-request-id": "r-1",
        "x-forwarded-for": "9.9.9.9",
      },
    });
    const ctx = createTestContext(req);
    const api = buildApiRouteContext(
      ctx,
      { id: "x" },
      { k: "1" },
      {
        path: "/api/hi",
        file: "api/hi.ts",
        fullPath: "/app/routes/api/hi.ts",
        isApi: true,
      },
    );
    expect(api.pathname).toBe("/api/hi");
    expect(api.path).toBe("/api/hi");
    expect(api.request).toBe(req);
    expect(api.req).toBe(req);
    expect(api.search).toBe("?k=1");
    expect(api.requestId).toBe("r-1");
    expect(api.clientIp).toBe("9.9.9.9");
    expect(api.matchedRoute).toEqual({
      path: "/api/hi",
      file: "api/hi.ts",
      fullPath: "/app/routes/api/hi.ts",
      isApi: true,
    });
  });
});
