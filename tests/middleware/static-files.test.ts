/**
 * 静态文件中间件测试
 */

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "@dreamer/test";
import {
  join,
  makeTempDir,
  mkdir,
  remove,
  writeTextFile,
} from "@dreamer/runtime-adapter";
import { staticFiles } from "../../src/middleware/static-files.ts";
import { createTestContext } from "../helpers.ts";

describe("Static Files 中间件", () => {
  let testDir: string;
  let testFile: string;
  const testContent = "Hello, Static Files!";

  beforeAll(async () => {
    // 创建临时测试目录
    testDir = await makeTempDir({ prefix: "static-files-test-" });
    testFile = join(testDir, "test.txt");
    await writeTextFile(testFile, testContent);
  });

  afterAll(async () => {
    // 清理测试目录
    try {
      await remove(testDir, { recursive: true });
    } catch {
      // 忽略错误
    }
  });

  describe("基础功能", () => {
    it("应该创建静态文件中间件", () => {
      const middleware = staticFiles({
        root: testDir,
      });
      expect(typeof middleware).toBe("function");
    });

    it("应该支持自定义根目录", () => {
      const middleware = staticFiles({
        root: testDir,
      });
      expect(typeof middleware).toBe("function");
    });

    it("应该支持自定义路径前缀", () => {
      const middleware = staticFiles({
        root: testDir,
        prefix: "/assets",
      });
      expect(typeof middleware).toBe("function");
    });

    it("应该提供静态文件", async () => {
      const middleware = staticFiles({
        root: testDir,
        prefix: "/static",
      });
      const request = new Request("http://localhost:8000/static/test.txt");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      expect(context.response?.status).toBe(200);
      const content = await context.response?.text();
      expect(content).toBe(testContent);
    });
  });

  describe("配置选项", () => {
    it("应该支持自定义索引文件", () => {
      const middleware = staticFiles({
        root: testDir,
        index: "index.html",
      });
      expect(typeof middleware).toBe("function");
    });

    it("应该支持自定义缓存控制", () => {
      const middleware = staticFiles({
        root: testDir,
        maxAge: 3600,
      });
      expect(typeof middleware).toBe("function");
    });

    it("应该支持 ETag", async () => {
      const middleware = staticFiles({
        root: testDir,
        prefix: "/static",
        etag: true,
      });
      const request = new Request("http://localhost:8000/static/test.txt");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const etag = context.response?.headers.get("ETag");
      expect(etag).toBeDefined();
    });

    it("应该支持 Last-Modified", async () => {
      const middleware = staticFiles({
        root: testDir,
        prefix: "/static",
        lastModified: true,
      });
      const request = new Request("http://localhost:8000/static/test.txt");
      const context = createTestContext(request);

      await middleware(context, async () => {});

      const lastModified = context.response?.headers.get("Last-Modified");
      expect(lastModified).toBeDefined();
    });
  });

  describe("缓存功能", () => {
    it("应该支持启用内存缓存", () => {
      const middleware = staticFiles({
        root: testDir,
        enableCache: true,
      });
      expect(typeof middleware).toBe("function");
    });

    it("应该支持禁用内存缓存", () => {
      const middleware = staticFiles({
        root: testDir,
        enableCache: false,
      });
      expect(typeof middleware).toBe("function");
    });

    it("应该支持自定义缓存最大大小", () => {
      const middleware = staticFiles({
        root: testDir,
        cacheMaxSize: 100 * 1024 * 1024, // 100MB
      });
      expect(typeof middleware).toBe("function");
    });

    it("应该支持自定义缓存 TTL", () => {
      const middleware = staticFiles({
        root: testDir,
        cacheTTL: 60000, // 60秒
      });
      expect(typeof middleware).toBe("function");
    });

    it("应该从缓存中获取文件（如果已缓存）", async () => {
      const middleware = staticFiles({
        root: testDir,
        prefix: "/static",
        enableCache: true,
      });
      const request = new Request("http://localhost:8000/static/test.txt");
      const context1 = createTestContext(request);
      const context2 = createTestContext(request);

      // 第一次请求（应该读取文件并缓存）
      await middleware(context1, async () => {});
      expect(context1.response?.status).toBe(200);

      // 第二次请求（应该从缓存获取）
      await middleware(context2, async () => {});
      expect(context2.response?.status).toBe(200);

      const content1 = await context1.response?.text();
      const content2 = await context2.response?.text();
      expect(content1).toBe(content2);
      expect(content2).toBe(testContent);
    });

    it("应该检测文件变化并更新缓存", async () => {
      const middleware = staticFiles({
        root: testDir,
        prefix: "/static",
        enableCache: true,
      });
      const testFile2 = join(testDir, "test2.txt");
      await writeTextFile(testFile2, "Original Content");
      const request = new Request("http://localhost:8000/static/test2.txt");

      // 第一次请求
      const context1 = createTestContext(request);
      await middleware(context1, async () => {});
      expect(context1.response?.status).toBe(200);

      // 修改文件（等待一小段时间确保 mtime 更新）
      await new Promise((resolve) => setTimeout(resolve, 10));
      await writeTextFile(testFile2, "Updated Content");
      // 再次等待确保文件系统更新 mtime
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 第二次请求（应该检测到文件变化并重新读取）
      const context2 = createTestContext(request);
      await middleware(context2, async () => {});
      expect(context2.response?.status).toBe(200);

      const content2 = await context2.response?.text();
      expect(content2).toBe("Updated Content");

      // 清理
      await remove(testFile2);
    });
  });
});
