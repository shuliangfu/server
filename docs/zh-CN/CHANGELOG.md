# 变更日志

本项目的所有重要变更将记录于此文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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
