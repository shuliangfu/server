/**
 * HMR 客户端脚本生成测试
 */

import { describe, expect, it } from "@dreamer/test";
import {
  generateHMRClientScript,
  injectHMRClient,
} from "../../src/dev/hmr-client.ts";

// 注意：esbuild 会启动子进程，在 Deno 环境下需要禁用资源清理检查
// 但在 Bun 环境下不需要，因为 Bun 会自动处理
describe("HMR 客户端脚本生成", () => {
  describe("injectHMRClient", () => {
    it("应该在 </body> 标签前注入脚本", () => {
      const html = "<html><body><p>Hello</p></body></html>";
      const script = "console.log('HMR');";
      const result = injectHMRClient(html, script);

      expect(result).toContain(script);
      expect(result).toContain("</body>");
      // 脚本应该在 </body> 之前
      const bodyIndex = result.indexOf("</body>");
      const scriptIndex = result.indexOf(script);
      expect(scriptIndex).toBeLessThan(bodyIndex);
    });

    it("应该在 </html> 标签前注入脚本（如果没有 </body>）", () => {
      const html = "<html><head></head><p>Hello</p></html>";
      const script = "console.log('HMR');";
      const result = injectHMRClient(html, script);

      expect(result).toContain(script);
      expect(result).toContain("</html>");
      // 脚本应该在 </html> 之前
      const htmlIndex = result.indexOf("</html>");
      const scriptIndex = result.indexOf(script);
      expect(scriptIndex).toBeLessThan(htmlIndex);
    });

    it("应该直接追加到末尾（如果既没有 </body> 也没有 </html>）", () => {
      const html = "<p>Hello</p>";
      const script = "console.log('HMR');";
      const result = injectHMRClient(html, script);

      expect(result).toContain(script);
      expect(result).toContain(html);
      // 脚本应该在 HTML 内容之后
      expect(result.endsWith(`<script>${script}</script>`)).toBe(true);
    });

    it("应该正确包装脚本标签", () => {
      const html = "<html><body></body></html>";
      const script = "console.log('HMR');";
      const result = injectHMRClient(html, script);

      expect(result).toContain(`<script>${script}</script>`);
    });
  });

  describe("generateHMRClientScript", () => {
    it("应该生成包含 WebSocket URL 的脚本", async () => {
      // 注意：esbuild 会启动子进程，在 Deno 环境下需要禁用资源清理检查
      // 但在 Bun 环境下不需要，因为 Bun 会自动处理
      const script = await generateHMRClientScript("/__hmr", 3000, "localhost");

      expect(typeof script).toBe("string");
      expect(script.length).toBeGreaterThan(0);
      // 应该包含 WebSocket URL（可能以 JSON 字符串形式）
      const wsUrlPattern = /ws:\/\/localhost:3000\/__hmr/;
      expect(wsUrlPattern.test(script)).toBe(true);
    });

    it("应该支持自定义路径", async () => {
      const script = await generateHMRClientScript(
        "/custom-hmr",
        8080,
        "example.com",
      );

      expect(script).toContain("ws://example.com:8080/custom-hmr");
    });

    it("应该支持自定义端口和主机", async () => {
      const script = await generateHMRClientScript("/__hmr", 9000, "127.0.0.1");

      expect(script).toContain("ws://127.0.0.1:9000/__hmr");
    });

    it("应该使用默认值", async () => {
      const script = await generateHMRClientScript();

      expect(script).toContain("ws://localhost:3000/__hmr");
    });
  });
}, {
  sanitizeOps: false, // esbuild 会启动子进程，需要禁用操作清理检查
  sanitizeResources: false, // esbuild 会创建资源，需要禁用资源清理检查
});
