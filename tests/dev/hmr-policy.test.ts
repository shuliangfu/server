/**
 * HMR 更新分类与客户端应用策略
 */

import { describe, expect, it } from "@dreamer/test";
import {
  determineHmrUpdateType,
  hmrBroadcastType,
  hmrClientApplyMode,
  type HmrRouteInferrer,
  hmrWebSocketUrlExpression,
  isHmrConfigFile,
} from "../../src/dev/hmr-policy.ts";

const inferrer: HmrRouteInferrer = {
  isLayoutFile: (p) => p.includes("_layout") || p.endsWith("/layout.tsx"),
  isPageFile: (p) => p.endsWith("/index.tsx") || p.endsWith("/page.tsx"),
  isComponentFile: (p) => p.includes("/components/") && p.endsWith(".tsx"),
};

describe("isHmrConfigFile", () => {
  it("识别常见配置文件", () => {
    expect(isHmrConfigFile("deno.json")).toBe(true);
    expect(isHmrConfigFile("package.json")).toBe(true);
    expect(isHmrConfigFile("tsconfig.json")).toBe(true);
    expect(isHmrConfigFile("vite.config.ts")).toBe(true);
    expect(isHmrConfigFile("tailwind.config.js")).toBe(true);
    expect(isHmrConfigFile("app.config.ts")).toBe(true);
  });

  it("不把业务 JSON 或页面当成配置", () => {
    expect(isHmrConfigFile("src/locales/zh-CN.json")).toBe(false);
    expect(isHmrConfigFile("src/routes/index.tsx")).toBe(false);
    expect(isHmrConfigFile("src/backend/assets/tailwind.css")).toBe(false);
  });
});

describe("determineHmrUpdateType", () => {
  it("配置文件为 config-update", () => {
    expect(determineHmrUpdateType("deno.json", inferrer)).toBe("config-update");
  });

  it("CSS 为 css-update", () => {
    expect(determineHmrUpdateType("src/backend/assets/tailwind.css", inferrer))
      .toBe("css-update");
  });

  it("布局、页面、组件走对应无感类型", () => {
    expect(determineHmrUpdateType("src/routes/_layout.tsx", inferrer)).toBe(
      "layout-update",
    );
    expect(determineHmrUpdateType("src/routes/index.tsx", inferrer)).toBe(
      "component-update",
    );
    expect(determineHmrUpdateType("src/components/Button.tsx", inferrer)).toBe(
      "component-update",
    );
  });

  it("其它脚本为 module-update", () => {
    expect(determineHmrUpdateType("src/common/utils/format.ts", inferrer)).toBe(
      "module-update",
    );
  });

  it("文案等其它文件为通用 update（客户端走无感刷新）", () => {
    expect(determineHmrUpdateType("src/locales/zh-CN.json", inferrer)).toBe(
      "update",
    );
  });
});

describe("hmrBroadcastType / hmrClientApplyMode", () => {
  it("配置变更广播为 reload，客户端整页刷新", () => {
    expect(hmrBroadcastType("config-update")).toBe("reload");
    expect(hmrClientApplyMode("reload")).toBe("reload");
    expect(hmrClientApplyMode("config-update")).toBe("reload");
  });

  it("CSS 走 css 策略", () => {
    expect(hmrBroadcastType("css-update")).toBe("css-update");
    expect(hmrClientApplyMode("css-update")).toBe("css");
  });

  it("组件、布局、模块和通用更新都走无感", () => {
    expect(hmrClientApplyMode("component-update")).toBe("seamless");
    expect(hmrClientApplyMode("layout-update")).toBe("seamless");
    expect(hmrClientApplyMode("module-update")).toBe("seamless");
    expect(hmrClientApplyMode("update")).toBe("seamless");
  });
});

describe("hmrWebSocketUrlExpression", () => {
  it("使用当前页面 protocol 与 host，并带上 HMR 路径", () => {
    const expr = hmrWebSocketUrlExpression("/__hmr");
    expect(expr).toContain("location.protocol");
    expect(expr).toContain("location.host");
    expect(expr).toContain("/__hmr");
    expect(expr).not.toContain("127.0.0.1");
    expect(expr).not.toContain("localhost");
  });

  it("在假 location 下解析为当前访问地址", () => {
    const expr = hmrWebSocketUrlExpression("/__hmr");
    const location = { protocol: "http:", host: "localhost:8001" };
    const wsUrl = Function("location", `"use strict"; return (${expr});`)(
      location,
    );
    expect(wsUrl).toBe("ws://localhost:8001/__hmr");

    const secure = Function("location", `"use strict"; return (${expr});`)({
      protocol: "https:",
      host: "127.0.0.1:8001",
    });
    expect(secure).toBe("wss://127.0.0.1:8001/__hmr");
  });
});
