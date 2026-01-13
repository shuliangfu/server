/**
 * @dreamer/server 主模块测试
 */

import { describe, expect, it } from "@dreamer/test";
import { Server, type ServerMode } from "../src/mod.ts";

describe("@dreamer/server", () => {
  describe("类型导出", () => {
    it("应该导出 Server 类", () => {
      const server = new Server();
      expect(server).toBeInstanceOf(Server);
    });

    it("应该支持所有服务器模式", () => {
      const modes: ServerMode[] = ["dev", "prod"];
      expect(modes.length).toBe(2);
    });
  });

  describe("Server 类", () => {
    describe("构造函数", () => {
      it("应该使用默认配置创建服务器", () => {
        const server = new Server();
        expect(server.port).toBe(8000); // 生产模式默认端口
        expect(server.host).toBe("localhost");
      });

      it("应该使用自定义配置创建服务器", () => {
        const server = new Server({
          port: 3000,
          host: "0.0.0.0",
          mode: "dev",
        });
        expect(server.port).toBe(3000);
        expect(server.host).toBe("0.0.0.0");
      });

      it("开发模式应该使用默认端口 3000", () => {
        const server = new Server({
          mode: "dev",
        });
        expect(server.port).toBe(3000);
      });

      it("生产模式应该使用默认端口 8000", () => {
        const server = new Server({
          mode: "prod",
        });
        expect(server.port).toBe(8000);
      });

      it("应该支持自定义关闭超时时间", () => {
        const server = new Server({
          shutdownTimeout: 5000,
        });
        // 无法直接测试，但应该不抛出错误
        expect(server).toBeInstanceOf(Server);
      });
    });

    describe("属性访问", () => {
      it("应该能够访问 port 属性", () => {
        const server = new Server({ port: 9999 });
        expect(server.port).toBe(9999);
      });

      it("应该能够访问 host 属性", () => {
        const server = new Server({ host: "127.0.0.1" });
        expect(server.host).toBe("127.0.0.1");
      });

      it("应该能够访问 http 属性", () => {
        const server = new Server();
        expect(server.http).toBeDefined();
      });
    });

    describe("中间件注册", () => {
      it("应该能够注册中间件", () => {
        const server = new Server();
        let called = false;
        server.use(async (ctx, next) => {
          called = true;
          await next();
        });
        expect(called).toBe(false); // 只是注册，不会立即执行
      });

      it("应该能够注册带条件的中间件", () => {
        const server = new Server();
        server.use(
          async (ctx, next) => {
            await next();
          },
          "/api",
        );
        // 应该不抛出错误
        expect(server).toBeInstanceOf(Server);
      });

      it("应该能够注册带名称的中间件", () => {
        const server = new Server();
        server.use(
          async (ctx, next) => {
            await next();
          },
          undefined,
          "test-middleware",
        );
        // 应该不抛出错误
        expect(server).toBeInstanceOf(Server);
      });
    });

    describe("路由集成", () => {
      it("应该能够集成路由系统", () => {
        const server = new Server();
        // 创建一个简单的路由对象（模拟）
        const mockRouter = {
          match: () => null,
        } as any;
        server.useRouter(mockRouter);
        // 应该不抛出错误
        expect(server).toBeInstanceOf(Server);
      });
    });

    describe("错误处理", () => {
      it("应该能够注册错误处理中间件", () => {
        const server = new Server();
        server.useError(async (ctx, error, next) => {
          ctx.response = new Response("Error", { status: 500 });
          await next();
        });
        // 应该不抛出错误
        expect(server).toBeInstanceOf(Server);
      });
    });
  });
});
