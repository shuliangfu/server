# @dreamer/server

> 一个兼容 Deno 和 Bun 的统一 HTTP 服务器库，提供开发和生产环境的完整服务器功能

[![JSR](https://jsr.io/badges/@dreamer/server)](https://jsr.io/@dreamer/server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE.md)
[![Tests](https://img.shields.io/badge/tests-126%20passed-brightgreen)](./TEST_REPORT.md)

---

## 🎯 功能

统一的 HTTP 服务器库，整合了 HTTP 服务器核心、开发工具（HMR、文件监听）和生产服务器功能。

## ✨ 特性

### HTTP 服务器核心

- ✅ **完整的 HTTP 应用功能**：
  - HTTP 服务器（基于 @dreamer/runtime-adapter）
  - 中间件系统集成（@dreamer/middleware）
  - 路由系统集成（@dreamer/router）
  - Cookie 管理（解析和设置）
  - 错误处理和日志记录（@dreamer/logger）
  - WebSocket 支持（用于 HMR 等）

### 开发服务器功能

- ✅ **HMR 热更新**：
  - WebSocket 服务器（用于与浏览器通信）
  - 文件监听（监听源代码变化）
  - 增量构建集成（与构建工具集成）
  - 客户端代码注入（HMR 客户端代码）

- ✅ **开发工具**：
  - 文件监听（自动监听源代码变化）
  - 构建集成（与 @dreamer/esbuild 集成）
  - 快速刷新

### 生产服务器功能

- ✅ **生产环境优化**：
  - 静态文件服务（生产构建产物）
  - 性能优化配置
  - 错误处理优化

---

## 📦 安装

```bash
deno add jsr:@dreamer/server
```

---

## 🌍 环境兼容性

- **运行时要求**：Deno 2.6+ 或 Bun 1.3.5
- **服务端**：✅ 支持（兼容 Deno 和 Bun 运行时）

---

## 🚀 快速开始

### 开发服务器

```typescript
import { Server } from "@dreamer/server";
import { cors, bodyParser, compression } from "@dreamer/server";

// 创建开发服务器
const server = new Server({
  mode: "dev",
  port: 3000,
  dev: {
    hmr: true, // 启用 HMR
    watch: ["./src"], // 监听文件变化
    builder: {
      // 构建器接口（用于增量构建）
      async rebuild() {
        // 执行增量构建
        return { outputFiles: [] };
      },
    },
  },
});

// 添加中间件
server.http.use(cors({ origin: "*" }));
server.http.use(bodyParser());
server.http.use(compression({ enableBrotli: true })); // 启用响应压缩

// 添加路由
server.http.use(async (ctx, next) => {
  if (ctx.path === "/") {
    ctx.response = new Response("Hello, World!");
    return;
  }
  await next();
});

// 启动服务器
await server.start();
```

**调试与日志**：若需排查请求处理顺序、路径前置处理器、中间件链等，可传入 `debug: true` 和自定义 `logger`（需将 logger 级别设为 `"debug"`），所有调试信息通过 `logger.debug` 输出：

```typescript
import { createLogger } from "@dreamer/logger";

const server = new Server({
  mode: "dev",
  port: 3000,
  debug: true,
  logger: createLogger({ level: "debug", format: "text" }),
  // ...
});
```

### 生产服务器

```typescript
import { Server } from "@dreamer/server";
import { cors, bodyParser, compression, staticFiles } from "@dreamer/server";

// 创建生产服务器
const server = new Server({
  mode: "prod",
  port: 8000,
});

// 添加中间件
server.http.use(cors({ origin: "*" }));
server.http.use(bodyParser());
server.http.use(compression({ enableBrotli: true })); // 启用响应压缩
server.http.use(staticFiles({ root: "./dist", prefix: "/static" }));

// 添加路由
server.http.use(async (ctx, next) => {
  if (ctx.path === "/") {
    ctx.response = new Response("Hello, World!");
    return;
  }
  await next();
});

// 启动服务器
await server.start();
```

---

## 📖 API 文档

### Server 类

#### 构造函数

```typescript
new Server(options?: ServerOptions)
```

**参数**：

- `options.mode?: "dev" | "prod"` - 服务器模式（默认：`"prod"`）
- `options.port?: number` - 端口号（默认：开发模式 3000，生产模式 8000）
- `options.host?: string` - 主机名（默认：`"localhost"`）
- `options.onListen?: (params: { host: string; port: number }) => void` - 监听回调
- `options.onError?: (error: Error) => Response | Promise<Response>` - 错误处理函数
- `options.logger?: Logger` - Logger 实例（未传时使用默认 logger，info/debug 等均通过 logger 输出）
- `options.debug?: boolean` - 是否启用调试日志（默认：`false`），开启后通过 `logger.debug` 输出请求路径、路径前置处理器、中间件链、响应状态等详细调试信息
- `options.dev?: DevConfig` - 开发工具配置（仅开发模式）

#### 方法

- `start(): Promise<void>` - 启动服务器
- `stop(): Promise<void>` - 停止服务器

#### 属性

- `http: Http` - HTTP 应用实例（用于添加中间件、路由等）
- `port: number` - 端口号（只读）
- `host: string` - 主机名（只读）

### DevConfig

开发工具配置选项：

```typescript
interface DevConfig {
  /** HMR 配置 */
  hmr?: HMRConfig | boolean;
  /** 文件监听配置 */
  watch?: WatchConfig | string[];
  /** 构建器接口（用于增量构建） */
  builder?: {
    rebuild(): Promise<{ outputFiles?: Array<{ path: string; contents: Uint8Array }> }>;
  };
}
```

### HMRConfig

HMR 配置选项：

```typescript
interface HMRConfig {
  /** 是否启用 HMR */
  enabled?: boolean;
  /** WebSocket 路径 */
  path?: string;
  /** 客户端脚本路径 */
  clientScript?: string;
}
```

### WatchConfig

文件监听配置选项：

```typescript
interface WatchConfig {
  /** 监听的文件/目录路径 */
  paths?: string[];
  /** 忽略的文件/目录模式 */
  ignore?: string[];
  /** 监听选项 */
  options?: {
    /** 是否递归监听子目录 */
    recursive?: boolean;
  };
}
```

---

## 🔌 路由集成

```typescript
import { Server } from "@dreamer/server";
import { createRouter } from "@dreamer/router";

const server = new Server({
  mode: "dev",
  port: 3000,
});

// 创建路由
const router = createRouter({
  routesDir: "./src/routes",
  apiMode: "restful",
});
await router.scan();

// 集成路由
server.http.useRouter(router);

await server.start();
```

---

## 🔄 HMR 使用

### 基本配置

```typescript
const server = new Server({
  mode: "dev",
  port: 3000,
  dev: {
    hmr: true, // 启用 HMR
    watch: ["./src"], // 监听文件变化
    builder: {
      async rebuild() {
        // 执行增量构建
        return { outputFiles: [] };
      },
    },
  },
});
```

### 自定义 HMR 路径

```typescript
const server = new Server({
  mode: "dev",
  port: 3000,
  dev: {
    hmr: {
      enabled: true,
      path: "/__hmr", // 自定义 WebSocket 路径
    },
    watch: ["./src"],
  },
});
```

---

## 📝 完整示例

### 开发服务器示例

```typescript
import {
  Server,
  cors,
  bodyParser,
  compression,
  requestLogger,
  requestId,
  errorHandler,
  performanceAnalyzer,
} from "@dreamer/server";
import { createRouter } from "@dreamer/router";

// 创建开发服务器
const server = new Server({
  mode: "dev",
  port: 3000,
  dev: {
    hmr: true,
    watch: ["./src"],
    builder: {
      async rebuild() {
        // 执行增量构建
        return { outputFiles: [] };
      },
    },
  },
});

// 添加中间件
server.http.use(cors({ origin: "*" }));
server.http.use(requestId()); // Request ID 追踪
server.http.use(bodyParser());
server.http.use(compression({ enableBrotli: true }));
server.http.use(requestLogger());
server.http.use(performanceAnalyzer()); // 性能分析（仅开发模式）
server.http.useError(errorHandler({
  isDev: true,
  provideSuggestions: true,
}));

// 集成路由
const router = createRouter({
  routesDir: "./src/routes",
  apiMode: "restful",
});
await router.scan();
server.http.useRouter(router);

// 启动服务器
await server.start();
```

### 生产服务器示例

```typescript
import {
  Server,
  cors,
  bodyParser,
  compression,
  staticFiles,
  requestId,
  metrics,
  responseCache,
  csrf,
  securityHeaders,
  errorHandler,
} from "@dreamer/server";

// 创建生产服务器
const server = new Server({
  mode: "prod",
  port: 8000,
});

// 添加中间件（按顺序）
server.http.use(cors({ origin: "https://example.com" }));
server.http.use(requestId()); // Request ID 追踪
server.http.use(securityHeaders()); // 安全头
server.http.use(csrf()); // CSRF 保护
server.http.use(bodyParser());
server.http.use(compression({ enableBrotli: true }));
server.http.use(metrics()); // Metrics 监控
server.http.use(responseCache()); // 响应缓存
server.http.use(staticFiles({
  root: "./dist",
  prefix: "/static",
  enableCache: true, // 启用静态文件缓存
}));
server.http.useError(errorHandler());

// 添加路由
server.http.use(async (ctx, next) => {
  if (ctx.path === "/") {
    ctx.response = new Response("Hello, World!");
    return;
  }
  await next();
});

// 启动服务器
await server.start();
```

## 📊 测试覆盖

- **总测试数**: 126 个测试用例
- **测试文件**: 9 个测试文件
- **通过率**: 100% ✅
- **测试报告**: 详见 [TEST_REPORT.md](./TEST_REPORT.md)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License - 详见 [LICENSE.md](./LICENSE.md)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
