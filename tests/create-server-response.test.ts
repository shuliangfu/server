/**
 * createServerResponse：与 dweb 行为一致的纯 Response 助手单测
 */

import { describe, expect, it } from "@dreamer/test";
import { createServerResponse } from "../src/context.ts";

describe("createServerResponse()", () => {
  const res = createServerResponse();

  describe("redirect()", () => {
    it("默认返回 302 且 Location 为给定 url", () => {
      const r = res.redirect("/login");
      expect(r.status).toBe(302);
      expect(r.headers.get("Location")).toBe("/login");
    });

    it("可指定 status（如 301）", () => {
      const r = res.redirect("/moved", 301);
      expect(r.status).toBe(301);
      expect(r.headers.get("Location")).toBe("/moved");
    });
  });

  describe("json()", () => {
    it("返回 application/json 且 body 为 { success, data } 封装", async () => {
      const r = res.json({ a: 1 });
      expect(r.headers.get("Content-Type")).toContain("application/json");
      expect(await r.json()).toEqual({ success: true, data: { a: 1 } });
    });

    it("init.status 非 2xx 时 success 为 false", async () => {
      const r = res.json({ error: "bad" }, { status: 400 });
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({
        success: false,
        data: { error: "bad" },
      });
    });

    /** 未传 data 时信封 data 为 null（与 undefined 分支一致） */
    it("仅传 init 或未传第一参时 data 为 null", async () => {
      const r = res.json(undefined);
      expect(await r.json()).toEqual({ success: true, data: null });
    });

    /** 边界：299 仍为 success true；300 为 success false */
    it("success 由 2xx 判定：299 为 true，300 为 false", async () => {
      const r299 = res.json({ x: 1 }, { status: 299 });
      expect(await r299.json()).toEqual({ success: true, data: { x: 1 } });
      const r300 = res.json(null, { status: 300 });
      const body300 = await r300.json() as { success: boolean };
      expect(body300.success).toBe(false);
    });
  });

  describe("html()", () => {
    it("返回 text/html 且 body 为给定字符串", async () => {
      const r = res.html("<p>hi</p>");
      expect(r.headers.get("Content-Type")).toContain("text/html");
      expect(await r.text()).toBe("<p>hi</p>");
    });
  });

  describe("text()", () => {
    it("返回 text/plain 且 body 为给定字符串", async () => {
      const r = res.text("plain");
      expect(r.headers.get("Content-Type")).toContain("text/plain");
      expect(await r.text()).toBe("plain");
    });
  });

  describe("binary()", () => {
    it("返回 application/octet-stream 且 body 为 Uint8Array", async () => {
      const data = new Uint8Array([1, 2, 3]);
      const r = res.binary(data);
      expect(r.headers.get("Content-Type")).toBe(
        "application/octet-stream",
      );
      const buf = await r.arrayBuffer();
      expect(new Uint8Array(buf)).toEqual(data);
    });

    it("接受 ArrayBuffer", async () => {
      const data = new ArrayBuffer(2);
      new Uint8Array(data).set([4, 5]);
      const r = res.binary(data);
      const buf = await r.arrayBuffer();
      expect(new Uint8Array(buf)).toEqual(new Uint8Array([4, 5]));
    });
  });

  describe("body()", () => {
    it("返回任意 body 与 init 的 Response", async () => {
      const r = res.body("custom", { status: 201 });
      expect(r.status).toBe(201);
      expect(await r.text()).toBe("custom");
    });
  });

  describe("status()", () => {
    it("仅设置状态码，无 body", () => {
      const r = res.status(204);
      expect(r.status).toBe(204);
      expect(r.body).toBeNull();
    });

    it("可指定 statusText", () => {
      const r = res.status(404, "Not Found");
      expect(r.status).toBe(404);
      expect(r.statusText).toBe("Not Found");
    });
  });
});
