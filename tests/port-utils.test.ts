/**
 * 端口检测工具与端口被占用逻辑测试
 *
 * 测试 isPortInUse、findAvailablePort 以及 Server 在端口被占用时自动使用 port+1 的行为
 */

import { afterEach, describe, expect, it } from "@dreamer/test";
import { serve as runtimeServe } from "@dreamer/runtime-adapter";
import { Server } from "../src/mod.ts";
import { findAvailablePort, isPortInUse } from "../src/port-utils.ts";

/** 测试用端口起点，避免与常见服务冲突 */
const TEST_BASE_PORT = 35900;

/** 等待服务器真正开始监听（onListen 触发后仍可能略有延迟） */
function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe("端口检测与占用", () => {
  /** 测试过程中启动的临时 server handle，用于 afterEach 关闭 */
  let tempHandle: { shutdown: () => Promise<void> } | null = null;

  afterEach(async () => {
    if (tempHandle) {
      await tempHandle.shutdown();
      tempHandle = null;
    }
  });

  describe("isPortInUse", () => {
    it("端口未被监听时应返回 false", async () => {
      // 先找一个当前未被占用的端口
      const freePort = await findAvailablePort("localhost", TEST_BASE_PORT);
      const inUse = await isPortInUse("localhost", freePort);
      expect(inUse).toBe(false);
    });

    it("端口已被监听时应返回 true", async () => {
      const port = await findAvailablePort("localhost", TEST_BASE_PORT);
      tempHandle = runtimeServe(
        { port, host: "localhost", onListen: () => {} },
        () => new Response("ok"),
      );
      await delay(150);
      const inUse = await isPortInUse("localhost", port);
      expect(inUse).toBe(true);
    });
  });

  describe("findAvailablePort", () => {
    it("起始端口可用时应直接返回该端口", async () => {
      const startPort = await findAvailablePort("localhost", TEST_BASE_PORT);
      const found = await findAvailablePort("localhost", startPort);
      expect(found).toBe(startPort);
    });

    it("起始端口被占用时应返回 startPort+1", async () => {
      const port = await findAvailablePort("localhost", TEST_BASE_PORT);
      tempHandle = runtimeServe(
        { port, host: "localhost", onListen: () => {} },
        () => new Response("ok"),
      );
      await delay(150);
      const found = await findAvailablePort("localhost", port);
      expect(found).toBe(port + 1);
    });

    it("连续多个端口被占用时应返回第一个可用端口", async () => {
      const port0 = await findAvailablePort("localhost", TEST_BASE_PORT);
      const port1 = port0 + 1;
      const h0 = runtimeServe(
        { port: port0, host: "localhost", onListen: () => {} },
        () => new Response("ok"),
      );
      const h1 = runtimeServe(
        { port: port1, host: "localhost", onListen: () => {} },
        () => new Response("ok"),
      );
      await delay(150);
      const found = await findAvailablePort("localhost", port0);
      expect(found).toBe(port0 + 2);
      await h0.shutdown();
      await h1.shutdown();
    });

    it("在 maxAttempts 内无可用端口时应抛出错误", async () => {
      const port = await findAvailablePort("localhost", TEST_BASE_PORT);
      tempHandle = runtimeServe(
        { port, host: "localhost", onListen: () => {} },
        () => new Response("ok"),
      );
      await delay(150);
      let thrown: Error | null = null;
      try {
        await findAvailablePort("localhost", port, 1);
      } catch (e) {
        thrown = e instanceof Error ? e : new Error(String(e));
      }
      expect(thrown).not.toBeNull();
      expect((thrown as Error).message).toContain("未找到可用端口");
    });
  });

  describe("Server 启动时端口被占用", () => {
    it("配置端口被占用时应自动使用 port+1 并记录日志", async () => {
      const port = await findAvailablePort("localhost", TEST_BASE_PORT);
      tempHandle = runtimeServe(
        { port, host: "localhost", onListen: () => {} },
        () => new Response("ok"),
      );
      await delay(150);

      const server = new Server({
        port,
        host: "localhost",
        mode: "prod",
      });
      await server.start();

      expect(server.port).toBe(port + 1);

      await server.stop();
    });

    it("配置端口可用时应在该端口监听且 server.port 与配置一致", async () => {
      const port = await findAvailablePort("localhost", TEST_BASE_PORT + 50);

      const server = new Server({
        port,
        host: "localhost",
        mode: "prod",
      });
      await server.start();

      expect(server.port).toBe(port);

      await server.stop();
    });
  });
});
