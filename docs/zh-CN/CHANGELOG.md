# 变更日志

本项目的所有重要变更将记录于此文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.1.9] - 2026-06-26

### 修复

- **`Http.listen()` WebSocket 升级**：对 `upgrade: websocket` 请求同步调用已注册
  的 WebSocket 处理器，不再走 async `handleRequest()`，使 Deno 能收到
  `upgradeWebSocket` 的原始 101 响应。修复挂载 `@dreamer/websocket` 或自定义 WS
  处理器时的 `Upgrade response was not returned from callback` 错误。

### 变更

- **依赖**：升级 `@dreamer/runtime-adapter` 至 `^1.0.19`（`serve()` 同步 handler
  支持 WebSocket 升级）。

---

## [1.1.8] - 2026-06-26

### 修复

- **`RouterAdapter`（action 模式）**：静态 API 路径（如 `/api/order`）在无路径
  末段 action 匹配时回落到 **`index`** 导出，修复 action 风格路由文件 **404**。
- **`RouterAdapter`（action 模式）**：处理器调用 **`res.json()`** 等但未
  **`return`** 时，通过 **`res.takeLastResponse()`** 取最后一次响应，避免
  **`undefined`** 导致 **404**。
- **`createServerResponse()`**：新增 **`takeLastResponse()`**，可获取
  **`res.json` / `res.text` / …** 辅助方法构建的最后一次响应。
- **`dev/hmr-browser.ts`**：定时器字段改为 **`ReturnType<typeof setTimeout>`**，
  兼容 Deno 与浏览器 timer 类型差异，使 **`deno check`** 通过。

### 测试

- **`tests/router-adapter.test.ts`**：覆盖 action 模式 **`index`** 回落，以及 未
  return 时 **`takeLastResponse`** 行为。

---

## [1.1.7] - 2026-05-08

### 新增

- **`RouterAdapterOptions.extendApiContext`**：可选钩子，在文件路由 API
  处理器执行前将额外字段合并进 **`ApiRouteContext`**（例如上层框架的
  **`app`**、**`container`**）。新增导出类型 **`ApiContextExtender`**，并由
  **`mod.ts`** 再导出。

### 测试

- **`tests/router-adapter.test.ts`**：覆盖 **`extendApiContext`** 将 **`app` /
  `container`** 合并进 API 处理器上下文。

---

## [1.1.6] - 2026-05-04

### 修复

- **`http/http.ts`**：对 WebSocket 升级响应（HTTP **`101`** 或响应头
  **`Upgrade: websocket`**）不再执行 **`CookieManager.applyToResponse`**。
  此类响应不能用 **`new Response(...)`** 重建，否则会破坏 Deno 的升级语义，
  可能导致 Socket.IO / 原生 WebSocket 握手失败（**500** 或升级中断）。

---

## [1.1.5] - 2026-04-21

### 变更

- **依赖**：**`@dreamer/router`** 升至 **`^1.1.7`**；**`package.json`** 将
  **`@dreamer/render`** 升至 **`^1.1.7`**；开发依赖 **`@dreamer/test`** 升至
  **`^1.1.8`**；**`@dreamer/esbuild`** 升至 **`^1.1.9`**。**`deno.json`**
  imports 同步。

---

## [1.1.4] - 2026-04-21

### 变更

- **`context.ts`**：将原 **`src/api-route-context.ts`** 中的 API 路由类型与
  **`ServerResponse`**、**`buildApiRouteContext`**、**`createServerResponse`**
  等合并至 **`context.ts`**，并删除独立文件；**`mod.ts`** 对外导出保持不变。

### 测试

- **`tests/create-server-response.test.ts`**：覆盖 **`createServerResponse()`**
  （**`redirect`**、**`json`**
  封装与状态边界、**`html`**、**`text`**、**`binary`**、
  **`body`**、**`status`**）。
- **`tests/i18n.test.ts`**：覆盖 **`setServerLocale`**、**`$tr`**（语言切换、
  第三参临时语言、占位符替换）。
- **`tests/req-context.test.ts`**：覆盖 pathname/search 辅助、请求 ID / 客户端
  IP、匹配路由快照及 **`buildApiRouteContext`** 扩展字段。

---

## [1.1.2] - 2026-04-17

### 变更

- **`createServerResponse().json()`**：响应体统一为
  **`{ success: boolean, data:
  unknown }`**。第一参序列化为
  **`data`**（未传则为 **`null`**）。**`success`** 由 **`init.status`**
  推导：HTTP 状态码为 **2xx**（默认 **200**）时为 **`true`**，否则为
  **`false`**。与 **`@dreamer/dweb`** 的 **`createServerResponse`**
  行为一致，便于文件路由 API 统一返回结构。

### 测试

- **`tests/router-adapter.test.ts`**：针对 **`ctx.res.json()`** 封装后的 JSON
  结构更新断言。

---

## [1.1.1] - 2026-04-17

### 新增

- **`ApiRouteContext` / `ApiContext`**：可选字段 **`body`** — 当
  **`Content-Type`** 含 **`json`** 且存在可读正文时，**`RouterAdapter`** 在调用
  API 处理器前用 **`req.json()`** 解析并写入 **`ctx.body`**（跳过
  GET/HEAD；解析失败则为 **`undefined`**）。此后**勿再**对 **`req`** 调用
  **`json()`** / **`text()`**。

### 测试

- **`tests/router-adapter.test.ts`**：覆盖 POST **`application/json`** 时
  **`apiCtx.body`** 的注入。

---

## [1.1.0] - 2026-04-17

### 新增

- **`api-route-context.ts`**：从包入口（`mod.ts`）导出 **`ApiRouteContext`**、
  **`ApiContext`**（别名）、**`ServerResponse`**、**`buildApiRouteContext`**、
  **`createServerResponse`**。

### 变更

- **破坏性变更 — `RouterAdapter`**：文件路由 API 处理器改为接收单一参数
  **`ApiRouteContext`**（含 `req`、`res`、`url`、`params`、`query`、`method`、
  `cookies`、`headers`、可选 `session` 及索引签名），不再使用
  **`(request, { params, query })`**。
- **`RouterAdapter`**：**`resolveApiHandler`** — restful 模式优先匹配
  **`handlers[GET|POST|…]`**；当路由实例提供 **`getApiMode()`** 且返回
  **`"action"`** 时，按 **`params.action`** / **`params.method`**、路径末段或
  kebab 转 camel（如 `test-connection` → **`testConnection`**）解析导出函数。

---

## [1.0.11] - 2026-04-07

### 修复

- **HMR 状态面板**：浏览器端在每次 WebSocket 重连时复用已有
  `#__hmr-status-container` 及内部指示器/进度条/统计面板；若存在多个同 id
  容器会清理重复；`lang` 的 `MutationObserver` 仅注册一次。

### 性能

- **Http**：`processRequest` 与 `createContext` 共用已解析的 `URL`；无查询串时不
  构建 `query`；未配置 `pathHandlers` 时复用共享空数组。
- **RouterAdapter**：API 处理器返回非 `Response` 时使用 `Response.json()`。
- **DevTools**：文件监听启动时一次性规范化 `watch.ignore` 规则。
- **HMR 客户端脚本**（`hmr-browser.ts`）：合并优先级表提升为模块级常量；自后向前
  一次扫描取得最近 `chunkUrl` / `routePath` / `routeChunkUrls`；合并路径时避免
  `Array.from(Set)` 整表拷贝。

---

## [1.0.10] - 2026-04-06

### 新增

- **HMR `routeChunkUrls`**：开发态 `builder.rebuild()` 的返回值可包含可选字段
  `routeChunkUrls`（路由 component 标识 → chunk URL）。DevTools WebSocket
  广播会携带该字段；合并后的 HMR 消息保留最近一次映射。应用可将其与
  `chunkUrl`、`routePath` 一并传给 `__HMR_REFRESH__`，在共享模块变更时仅按当前
  路由拉取新 chunk，无需整页刷新（如 `@dreamer/dweb`）。

### 变更

- **类型**：`DevConfig.builder.rebuild` 的返回类型补充可选 `routeChunkUrls`。

---

## [1.0.9] - 2026-02-19

### 变更

- **i18n**：i18n 在加载 i18n 模块时自动初始化；`initServerI18n` 不再导出。已从
  `mod.ts` 中移除显式 `initServerI18n()` 调用；`$tr` 与 `setServerLocale`
  调用时仍会确保完成初始化。
- **依赖**：升级 @dreamer/console、@dreamer/render、@dreamer/middleware、
  @dreamer/router、@dreamer/runtime-adapter、@dreamer/test、@dreamer/esbuild。

---

## [1.0.8] - 2026-02-19

### 变更

- **i18n**：翻译方法由 `$t` 重命名为 `$tr`，避免与全局 `$t`
  冲突。请将现有代码中本包消息改为使用 `$tr`。

---

## [1.0.7] - 2026-02-17

### 变更

- **i18n**：仅在入口初始化；`mod.ts` 中调用一次 `initServerI18n()`。`$t()`
  内不再调用 `ensureServerI18n()` 或设置 locale。
- **依赖**：更新 JSR 依赖（如 @dreamer/console、@dreamer/esbuild）。

---

## [1.0.6] - 2026-02-17

### 新增

- **服务端 i18n**：`ServerOptions`、`DevConfig`、`HttpServerOptions` 支持可选
  `lang`（如 `"en-US"`、`"zh-CN"`）。不传时从环境变量 `LANGUAGE` / `LC_ALL` /
  `LANG` 自动检测。所有服务端文案（日志、错误、404/503
  响应正文、HMR/构建消息、端口检测等）均已翻译。新增 `src/i18n.ts` 与
  `src/locales/en-US.json`、`zh-CN.json`。

### 变更

- **文档**：README 与 zh-CN README 在特性与 API 章节中补充 `lang` 选项及服务端
  i18n 说明。

---

## [1.0.5] - 2026-02-10

### 变更

- **PathHandler**：`PathHandler.handler` 可返回 `null` 或 `undefined`
  表示不处理当前请求，交由下一个 path handler 或中间件链处理（此前返回类型仅为
  `Response | Promise<Response>`）。

---

## [1.0.4] - 2026-02-10

### 新增

- **HMR routePath**：DevTools 广播与 HMR 浏览器端现在在更新消息中携带
  `routePath`（对应更新 chunk 的路由路径），并随 `chunkUrl` 一并传入应用注册的
  `__HMR_REFRESH__` 回调，支持 view/dweb 的细粒度路由级 HMR。

### 变更

- **HMR 刷新钩子名称**：无感 HMR 更新的全局回调现统一为
  `__HMR_REFRESH__`（替代原先的 `__DWEB_HMR_REFRESH__`）。

---

## [1.0.3] - 2026-02-10

### 修复

- **与静态中间件一起使用时 HMR 不启动**：在 DevTools 构造函数中注册 HMR
  WebSocket 与注入中间件（不再在 `start()` 中注册），使注入中间件先于
  `staticFiles` 执行，从而能向 HTML 响应注入 HMR 客户端脚本；在 `listen()`
  前调用 `devTools.start(actualPort)`，保证客户端脚本使用正确端口。

---

## [1.0.2] - 2026-02-11

### 新增

- **端口检测**：`isPortInUse(port)`、`findAvailablePort(startPort, options)`；配置端口被占用时
  Server 自动使用下一个可用端口

### 变更

- **文档**：变更日志与测试报告迁至 `docs/en-US/` 与 `docs/zh-CN/`，并增加中文版
  CHANGELOG、TEST_REPORT

---

## [1.0.1] - 2026-02-07

### 新增

- **HMR 面板 i18n**：根据 `document.documentElement.lang` 或
  `navigator.language` 显示中/英文
- **MutationObserver**：监听 `lang` 属性变化，语言切换时自动刷新 HMR 界面（无需
  i18n 库）

### 修复

- **disconnect() 内存泄漏**：程序化断开 HMR 时移除
  `visibilitychange`、`DOMContentLoaded` 监听器，并调用 `statusUI.destroy()`（含
  MutationObserver disconnect）

---

## [1.0.0] - 2026-02-06

### 新增

首个稳定版。统一 HTTP 服务器库，兼容 Deno 与
Bun，完整支持开发（HMR、文件监听）与生产环境。

#### 服务器核心

- **Server 类**：开发/生产模式，`start()`、`stop()`，`http` 属性用于中间件与路由
- **Http 类**：中间件注册、路由集成、错误处理、请求/响应处理、优雅关闭
- **serve 函数**：底层 HTTP 服务（基于 @dreamer/runtime-adapter）
- **选项**：`mode`、`port`、`host`、`onListen`、`onError`、`logger`、`debug`、`dev`

#### HTTP 上下文与 Cookie

- **HttpContext**：path、method、headers、body、state、response、error
- **CookieManager**：解析与设置 Cookie，与 HttpContext 集成
- **parseCookie** / **serializeCookie**：Cookie 解析与序列化
- **类型**：`CookieOptions`、`HttpError`

#### 路由集成

- **RouterAdapter**：路由匹配、动态参数、SSR 渲染回调
- **useRouter**：集成 @dreamer/router 与 Http
- **类型**：`RouterAdapterOptions`、`SSRRenderCallback`

#### 开发工具

- **HMR**：WebSocket
  服务、客户端脚本注入（`injectHMRClient`、`generateHMRClientScript`）
- **文件监听**：监听源码变更，可配置路径与忽略规则
- **路由推断**：Layout/page/component 文件检测，自定义模式
- **模块依赖图**：依赖追踪、模块管理
- **性能监控**：更新记录、统计、指标、清理
- **DevConfig**：`hmr`、`watch`、`builder`（增量构建）

#### 中间件与路由再导出

- 从 @dreamer/middlewares 再导出中间件 API 以保持向后兼容
- 再导出类型：`Middleware`、`MiddlewareChain`、`MiddlewareContext`（@dreamer/middleware）
- 再导出类型：`RouteMatch`、`Router`（@dreamer/router）

#### 类型导出

- `DevConfig`、`HMRConfig`、`ServerMode`、`ServerOptions`、`WatchConfig`
- `HttpServerOptions`、`PathHandler`
- `CookieOptions`、`HttpContext`、`HttpError`
