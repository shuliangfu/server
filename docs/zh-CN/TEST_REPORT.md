# @dreamer/server 测试报告

## 📊 测试概览

- **测试库版本**：@dreamer/test@^1.1.8
- **测试框架**：@dreamer/test（兼容 Deno 与 Bun）
- **测试日期**：2026-05-08
- **测试环境**：
  - Deno 2.6+
  - Bun 1.3.5

## 📈 测试结果

### 总体统计

- **总用例数（Deno）**：176（`deno test -A tests/`）
- **通过**：176 ✅
- **失败**：0
- **通过率**：100% ✅
- **测试文件数**：13

### Bun

- **`bun test tests/`**：164 通过、0 失败（同样 **13** 个测试文件）。与 Deno
  计数略有差异来自测试运行器实现；两侧均为绿色。

### 测试文件统计

| 模块         | 测试文件                          | 用例数 | 状态        |
| ------------ | --------------------------------- | ------ | ----------- |
| **核心**     |                                   |        |             |
|              | `context.test.ts`                 | 7      | ✅ 全部通过 |
|              | `cookie.test.ts`                  | 20     | ✅ 全部通过 |
|              | `create-server-response.test.ts`  | 14     | ✅ 全部通过 |
|              | `http.test.ts`                    | 18     | ✅ 全部通过 |
|              | `i18n.test.ts`                    | 5      | ✅ 全部通过 |
|              | `mod.test.ts`                     | 16     | ✅ 全部通过 |
|              | `port-utils.test.ts`              | 9      | ✅ 全部通过 |
|              | `req-context.test.ts`             | 8      | ✅ 全部通过 |
|              | `router-adapter.test.ts`          | 11     | ✅ 全部通过 |
| **开发工具** |                                   |        |             |
|              | `dev/hmr-client.test.ts`          | 9      | ✅ 全部通过 |
|              | `dev/module-graph.test.ts`        | 14     | ✅ 全部通过 |
|              | `dev/performance-monitor.test.ts` | 14     | ✅ 全部通过 |
|              | `dev/route-inference.test.ts`     | 31     | ✅ 全部通过 |

### 说明

- **中间件测试**：已迁移至
  [@dreamer/middlewares](https://jsr.io/@dreamer/middlewares)，本库仅再导出中间件
  API 以保持兼容。

## 🔍 功能测试摘要

### 1. 核心模块

#### 1.1 HTTP 上下文 (context.test.ts) - 7 个用例

- ✅ HTTP 上下文创建与属性访问
- ✅ Cookie 管理器集成、状态管理、查询参数解析
- ✅ path、method、URL 访问

#### 1.2 Cookie 管理 (cookie.test.ts) - 20 个用例

- ✅ parseCookie / serializeCookie / CookieManager 完整流程

#### 1.3 服务端响应助手 (create-server-response.test.ts) - 14 个用例

- ✅
  **`createServerResponse()`**：**`redirect`**（默认与自定义状态码）、**`json`**
  （**`{ success, data }`**、未传 data、状态 **299** /
  **300**）、**`html`**、**`text`**、 **`binary`**（Uint8Array /
  ArrayBuffer）、**`body`**、**`status`**

#### 1.4 HTTP 应用 (http.test.ts) - 18 个用例

- ✅ Http 构造、中间件注册、路由集成、错误处理、请求/响应处理、优雅关闭

#### 1.5 主模块 (mod.test.ts) - 16 个用例

- ✅ Server 类、类型导出、中间件/路由/错误处理注册

#### 1.6 服务端 i18n (i18n.test.ts) - 5 个用例

- ✅ **`setServerLocale`**、**`$tr`**（中英文文案、第三参临时语言、占位符替换）

#### 1.7 路由适配器 (router-adapter.test.ts) - 11 个用例

- ✅ RouterAdapter 实例、路由匹配、动态参数、API
  上下文形态、**`extendApiContext`** 合并字段、**`apiMode`**、REST / action
  解析、POST JSON **`body`** 注入

#### 1.8 请求上下文辅助 (req-context.test.ts) - 8 个用例

- ✅ **`pathnameFromHref`**、**`searchFromHref`**、**`resolveRequestId`**、
  **`resolveClientIp`**、**`snapshotMatchedRoute`**、**`buildApiRouteContext`**
  扩展字段

#### 1.9 端口检测与占用 (port-utils.test.ts) - 9 个用例

- ✅ isPortInUse：端口空闲返回 false，被占用返回 true
- ✅ findAvailablePort：起始端口空闲时返回该端口；被占用时返回
  startPort+1；连续多端口占用时返回第一个可用；maxAttempts 内无可用时抛出
- ✅ Server 启动：配置端口被占用时使用 port+1 且 server.port
  为实际端口；端口空闲时在配置端口监听

### 2. 开发工具

#### 2.1 HMR 客户端 (dev/hmr-client.test.ts) - 9 个用例

- ✅ injectHMRClient、generateHMRClientScript

#### 2.2 路由推断 (dev/route-inference.test.ts) - 31 个用例

- ✅ 路由推断、Layout/page/component 文件检测、自定义模式

#### 2.3 模块依赖图 (dev/module-graph.test.ts) - 14 个用例

- ✅ 模块管理、依赖追踪、删除与查询

#### 2.4 性能监控 (dev/performance-monitor.test.ts) - 14 个用例

- ✅ 更新记录、统计、性能指标、数据清理

## 📊 测试质量

- ✅ **功能覆盖**：核心与开发工具均有测试
- ✅ **边界与错误**：边界情况与错误处理已覆盖
- ✅ **资源清理**：测试正确清理资源
- ✅ **跨运行时**：Deno 与 Bun 均通过

## 🔧 已知问题

无。全部测试通过。

## 📝 结论

✅ **Deno 共 176 个用例通过，通过率 100%**

✅ **端口占用**：端口检测（isPortInUse、findAvailablePort）及 Server
在端口冲突时自动 port+1 由 port-utils.test.ts 覆盖

✅ **中间件**：实现与测试已迁移至 @dreamer/middlewares，本库仅再导出以保持兼容

**@dreamer/server 可用于生产环境。**

---

_最后更新：2026-05-08_
