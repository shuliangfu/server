/**
 * server 包 i18n：setServerLocale / $tr 行为单测（不依赖环境探测顺序）
 */

import { beforeEach, describe, expect, it } from "@dreamer/test";
import { $tr, setServerLocale } from "../src/i18n.ts";

describe("server i18n", () => {
  /** 保证各用例从英文基线出发，避免执行顺序导致语言串台 */
  beforeEach(() => {
    setServerLocale("en-US");
  });

  it("setServerLocale(en-US) 时返回英文文案", () => {
    expect($tr("hmr.connected")).toBe("HMR connected");
  });

  it("setServerLocale(zh-CN) 时返回中文文案", () => {
    setServerLocale("zh-CN");
    expect($tr("hmr.connected")).toBe("HMR 已连接");
  });

  it("第三参 lang 临时切换语言且不改变模块当前 locale", () => {
    setServerLocale("en-US");
    const zh = $tr("hmr.connected", undefined, "zh-CN");
    expect(zh).toBe("HMR 已连接");
    expect($tr("hmr.connected")).toBe("HMR connected");
  });

  it("占位符参数应被替换", () => {
    setServerLocale("en-US");
    const t = $tr("error.fetchHmrClientFailed", {
      status: "500",
      statusText: "ERR",
      url: "http://x",
    });
    expect(t).toContain("500");
    expect(t).toContain("ERR");
    expect(t).toContain("http://x");
  });
});
