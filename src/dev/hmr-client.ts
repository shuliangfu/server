/**
 * HMR 客户端脚本生成
 *
 * 通过当前模块 URL 推导 hmr-browser.ts 的 URL，fetch 获取源码后用 esbuild 编译返回给浏览器
 */

import { esbuild } from "@dreamer/esbuild";
import { $tr, type Locale } from "../i18n.ts";

// 缓存编译后的脚本
let compiledScriptCache: string | null = null;

/**
 * 根据当前模块 URL 与相对路径得到 hmr-browser.ts 的 URL
 *
 * @returns hmr-browser.ts 的完整 URL（支持 file:// 与 JSR 等）
 */
function getHmrBrowserScriptUrl(): string {
  return new URL("./hmr-browser.ts", import.meta.url).href;
}

/**
 * 生成 HMR 客户端脚本
 *
 * 通过 fetch 获取 hmr-browser.ts 源码，使用 esbuild stdin 编译（不依赖入口文件路径）
 *
 * @param hmrPath WebSocket 路径
 * @param port 服务器端口
 * @param host 服务器主机名
 * @param lang 服务端文案语言（可选）；不传则从环境变量自动检测
 * @returns HMR 客户端脚本代码（编译后的 JavaScript）
 */
export async function generateHMRClientScript(
  hmrPath: string = "/__hmr",
  port: number = 3000,
  host: string = "localhost",
  lang?: Locale,
): Promise<string> {
  // 如果已缓存，直接返回
  if (compiledScriptCache) {
    return injectWSUrl(compiledScriptCache, hmrPath, port, host);
  }

  try {
    // 通过相对路径得到 hmr-browser.ts 的 URL（支持 file:// 与 JSR 等）
    const browserScriptUrl = getHmrBrowserScriptUrl();

    // 通过 fetch 获取 hmr-browser.ts 源码（使用 RequestInit 明确请求方式与 Accept）
    const requestInit: RequestInit = {
      method: "GET",
      headers: {
        Accept: "text/plain, application/typescript, */*",
      },
    };
    const response: Response = await fetch(browserScriptUrl, requestInit);
    if (!response.ok) {
      throw new Error(
        $tr("error.fetchHmrClientFailed", {
          status: String(response.status),
          statusText: response.statusText,
          url: browserScriptUrl,
        }, lang),
      );
    }
    const sourceContent = await response.text();

    // 使用 esbuild stdin 编译（直接传内容，不依赖入口文件路径）
    const result = await esbuild.build({
      stdin: {
        contents: sourceContent,
        sourcefile: "hmr-browser.ts",
        loader: "ts",
      },
      bundle: true,
      write: false,
      format: "iife", // 立即执行函数表达式，适合注入到 HTML
      target: "es2020",
      minify: false, // 开发环境不压缩，方便调试
      platform: "browser",
      // 将 React/Preact 等库标记为外部依赖，避免打包
      external: [
        "react",
        "react-dom",
        "react-dom/client",
        "preact",
        "@creamer/view",
        "@dreamer/render",
        "@dreamer/render/client",
      ],
      define: {
        "globalThis.document": "document",
        "globalThis.location": "location",
      },
    });

    // 获取编译后的代码
    const compiledCode = new TextDecoder().decode(
      result.outputFiles[0].contents,
    );

    // 缓存编译结果
    compiledScriptCache = compiledCode;

    // 注入 WebSocket URL
    return injectWSUrl(compiledCode, hmrPath, port, host);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error($tr("hmr.compileClientScriptFailed", { message }, lang));
    // 如果编译失败，返回一个简单的回退脚本
    return generateFallbackScript(hmrPath, port, host, lang);
  }
}

/**
 * 注入 WebSocket URL 到编译后的脚本中
 *
 * @param script 编译后的脚本代码
 * @param hmrPath WebSocket 路径
 * @param port 服务器端口
 * @param host 服务器主机名
 * @returns 注入 URL 后的脚本
 */
function injectWSUrl(
  script: string,
  hmrPath: string,
  port: number,
  host: string,
): string {
  // 确定协议（ws 或 wss）
  const protocol = "ws:"; // 开发环境默认使用 ws
  const wsUrl = `${protocol}//${host}:${port}${hmrPath}`;

  // 替换占位符 wsUrl
  // 查找 const wsUrl = ""; 或 var wsUrl = ""; 或 const wsUrl = ''; 并替换
  // 支持编译后的不同格式（const 或 var）
  const wsUrlPattern = /(const|var)\s+wsUrl\s*=\s*["'][^"']*["']\s*;/;
  const match = script.match(wsUrlPattern);
  if (match) {
    // 保持原有的声明方式（const 或 var）
    const declaration = match[1]; // "const" 或 "var"
    return script.replace(
      wsUrlPattern,
      `${declaration} wsUrl = ${JSON.stringify(wsUrl)};`,
    );
  }

  // 如果没找到，尝试直接替换（向后兼容）
  return script.replace(
    /wsUrl\s*=\s*["'][^"']*["']\s*;/,
    `wsUrl = ${JSON.stringify(wsUrl)};`,
  );
}

/**
 * 生成回退脚本（当编译失败时使用）
 *
 * @param hmrPath WebSocket 路径
 * @param port 服务器端口
 * @param host 服务器主机名
 * @param lang 服务端文案语言（可选），用于回退脚本中的日志文案
 * @returns 回退脚本代码
 */
function generateFallbackScript(
  hmrPath: string,
  port: number,
  host: string,
  lang?: Locale,
): string {
  const protocol = "ws:";
  const wsUrl = `${protocol}//${host}:${port}${hmrPath}`;
  const connectedMsg = $tr("hmr.connected", undefined, lang);

  return `
(function() {
  'use strict';
  const wsUrl = ${JSON.stringify(wsUrl)};
  let ws = null;

  function connect() {
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => console.log(${JSON.stringify(connectedMsg)});
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'reload' || msg.type === 'update') {
            location.reload();
          }
        } catch {}
      };
      ws.onclose = () => setTimeout(connect, 1000);
    } catch (e) {
      setTimeout(connect, 1000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect);
  } else {
    connect();
  }
})();
`.trim();
}

/**
 * 将 HMR 客户端脚本注入到 HTML 中
 *
 * @param html HTML 内容
 * @param script HMR 客户端脚本代码
 * @returns 注入后的 HTML
 */
export function injectHMRClient(html: string, script: string): string {
  // 查找 </body> 标签，在其前注入脚本
  const bodyCloseIndex = html.lastIndexOf("</body>");
  if (bodyCloseIndex !== -1) {
    const scriptTag = `<script>${script}</script>`;
    return (
      html.slice(0, bodyCloseIndex) +
      scriptTag +
      "\n" +
      html.slice(bodyCloseIndex)
    );
  }

  // 如果没有 </body> 标签，在 </html> 前注入
  const htmlCloseIndex = html.lastIndexOf("</html>");
  if (htmlCloseIndex !== -1) {
    const scriptTag = `<script>${script}</script>`;
    return (
      html.slice(0, htmlCloseIndex) +
      scriptTag +
      "\n" +
      html.slice(htmlCloseIndex)
    );
  }

  // 如果都没有，直接追加到末尾
  return html + `<script>${script}</script>`;
}
