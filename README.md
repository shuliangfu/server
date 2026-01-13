# @dreamer/server

> 一个兼容 Deno 和 Bun 的统一 HTTP 服务器库，提供开发和生产环境的完整服务器功能

[![JSR](https://jsr.io/badges/@dreamer/server)](https://jsr.io/@dreamer/server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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

- ✅ **内置中间件**（19 个）：
  - **基础中间件**：body-parser, compression, cors, error-handler, health-check, rate-limit, request-logger, security-headers, static-files, timeout
  - **新增中间件**：request-id, metrics, response-cache, csrf, request-validator, performance-analyzer, request-signature
  - **缓存支持**：static-files 已集成 LRU 内存缓存，response-cache 提供 HTTP 响应缓存
  - **安全增强**：security-headers 支持更多安全头和动态策略，request-signature 提供请求签名验证

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
- `options.logger?: Logger` - Logger 实例
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

## 🔧 中间件

### CORS 中间件

```typescript
import { cors } from "@dreamer/server";

server.http.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));
```

### Body Parser 中间件

```typescript
import { bodyParser } from "@dreamer/server";

server.http.use(bodyParser());
```

### 响应压缩中间件

自动压缩 HTTP 响应体，支持 gzip 和 brotli 压缩算法。

```typescript
import { compression } from "@dreamer/server";

// 使用默认配置（仅 gzip）
server.http.use(compression());

// 启用 brotli 压缩
server.http.use(compression({
  enableBrotli: true, // 启用 brotli 压缩
  level: 9, // 压缩级别（1-9，仅适用于 gzip，默认：6）
  threshold: 1024, // 最小响应大小（字节），小于此大小不压缩（默认：1024）
  filter: (contentType: string) => {
    // 自定义内容类型过滤（默认只压缩文本类型）
    return contentType.startsWith("text/") || contentType.includes("json");
  },
}));
```

**配置选项**：
- `level?: number` - 压缩级别（1-9，默认：6，仅适用于 gzip）
- `threshold?: number` - 最小响应大小（字节），小于此大小不压缩（默认：1024）
- `filter?: (contentType: string) => boolean` - 内容类型过滤器（默认只压缩文本类型）
- `enableBrotli?: boolean` - 是否启用 brotli 压缩（默认：false，需要运行时支持）

**特性**：
- ✅ 自动检测客户端支持的压缩算法（gzip、brotli）
- ✅ 优先使用 brotli（如果客户端支持且启用）
- ✅ 只压缩文本类型内容（可自定义）
- ✅ 只压缩大于阈值的响应（可配置）
- ✅ 跨运行时兼容（Deno 和 Bun）

### 静态文件中间件

```typescript
import { staticFiles } from "@dreamer/server";

server.http.use(staticFiles({
  root: "./public",
  prefix: "/static",
}));
```

### 请求日志中间件

```typescript
import { requestLogger } from "@dreamer/server";

server.http.use(requestLogger());
```

### 错误处理中间件

增强的错误处理中间件，支持开发模式详细错误信息和智能修复建议。

```typescript
import { errorHandler } from "@dreamer/server";

// 使用默认配置
server.http.useError(errorHandler());

// 开发模式配置
server.http.useError(errorHandler({
  isDev: true, // 开发模式，自动包含详细信息
  provideSuggestions: true, // 提供错误修复建议
}));
```

**功能特性**：
- ✅ 开发模式自动包含详细错误信息（堆栈、上下文）
- ✅ 智能错误修复建议（基于错误类型）
- ✅ 开发模式下 JSON 响应自动格式化
- ✅ 错误上下文信息（请求路径、参数、查询参数、请求头、Request ID）
- ✅ 自定义错误格式化函数

**配置选项**：
- `isDev?: boolean` - 是否为开发模式（默认：false）
- `provideSuggestions?: boolean` - 是否提供错误修复建议（默认：false）
- `includeDetails?: boolean` - 是否包含详细信息（默认：开发模式为 true）
- `formatError?: (error, ctx, includeDetails, isDev, provideSuggestions) => HttpError` - 自定义错误格式化函数

### Request ID 中间件

为每个请求生成唯一 ID，便于日志追踪和问题排查。

```typescript
import { requestId } from "@dreamer/server";

// 使用默认配置
server.http.use(requestId());

// 自定义配置
server.http.use(requestId({
  headerName: "X-Request-ID",
  includeInResponse: true,
  readFromHeader: true, // 如果请求头中已有 ID，则使用它
}));
```

**功能特性**：
- 自动生成 UUID v4 作为 Request ID
- 支持从请求头中读取 Request ID（用于分布式追踪）
- 自动在响应头中包含 Request ID
- 将 Request ID 存储到 context 中（`ctx.requestId`）

### Metrics 中间件

收集请求统计信息，提供 Prometheus 格式的指标。

```typescript
import { metrics } from "@dreamer/server";

// 使用默认配置（指标端点：/metrics）
server.http.use(metrics());

// 自定义配置
server.http.use(metrics({
  endpoint: "/prometheus",
  includePercentiles: true, // 包含 P50、P95、P99 分位数
  maxSamples: 1000, // 最大保留的响应时间样本数
}));
```

**功能特性**：
- 请求计数（总数、成功/失败、按状态码、按方法）
- 响应时间统计（平均值、最小值、最大值、分位数）
- Prometheus 格式的指标输出
- 可访问 `/metrics` 端点获取指标数据

**指标示例**：
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total 1000

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds summary
http_request_duration_seconds_sum 5.234
http_request_duration_seconds_count 1000
http_request_duration_seconds{quantile="0.5"} 0.005
http_request_duration_seconds{quantile="0.95"} 0.012
http_request_duration_seconds{quantile="0.99"} 0.025
```

### 静态文件中间件（增强版）

静态文件中间件现在支持内存缓存，显著提升性能。

```typescript
import { staticFiles } from "@dreamer/server";

// 使用默认配置（启用缓存）
server.http.use(staticFiles({
  root: "./public",
  prefix: "/static",
}));

// 自定义缓存配置
server.http.use(staticFiles({
  root: "./public",
  prefix: "/static",
  enableCache: true, // 启用内存缓存（默认：true）
  cacheMaxSize: 100 * 1024 * 1024, // 缓存最大大小：100MB（默认：50MB）
  cacheTTL: 0, // 缓存 TTL：0 表示不过期（默认：0）
}));
```

**性能优化**：
- LRU 缓存策略（自动淘汰最久未使用的文件）
- 文件变化检测（通过 mtime 比较）
- 减少文件系统 I/O
- 支持大文件缓存（超过缓存大小的文件不缓存）

### 响应缓存中间件

HTTP 响应缓存中间件，支持 LRU 缓存、ETag、Last-Modified 条件请求。

```typescript
import { responseCache } from "@dreamer/server";

// 使用默认配置
server.http.use(responseCache());

// 自定义配置
server.http.use(responseCache({
  maxSize: 100 * 1024 * 1024, // 缓存最大大小：100MB（默认：100MB）
  ttl: 3600 * 1000, // 缓存 TTL：1 小时（默认：0，不过期）
  cacheControl: "public", // 缓存策略（默认：public）
  maxAge: 3600, // Cache-Control max-age（默认：3600）
  etag: true, // 启用 ETag（默认：true）
  lastModified: true, // 启用 Last-Modified（默认：true）
  keyGenerator: (ctx) => `${ctx.method}:${ctx.path}`, // 自定义缓存键生成
  shouldCache: (ctx, response) => response.status === 200, // 自定义缓存策略
}));
```

**功能特性**：
- ✅ LRU 缓存策略
- ✅ 支持 ETag 和 Last-Modified 条件请求
- ✅ 自动返回 304 Not Modified
- ✅ 只缓存成功的响应（2xx）
- ✅ 自动跳过非 GET/HEAD 请求
- ✅ 支持自定义缓存键生成函数
- ✅ 支持自定义缓存策略（shouldCache、shouldSkip）

### CSRF 保护中间件

CSRF 保护中间件，使用 Double Submit Cookie 模式。

```typescript
import { csrf } from "@dreamer/server";

// 使用默认配置
server.http.use(csrf());

// 自定义配置
server.http.use(csrf({
  cookieName: "_csrf", // Cookie 名称（默认：_csrf）
  headerName: "X-CSRF-Token", // 请求头名称（默认：X-CSRF-Token）
  fieldName: "_csrf", // 表单字段名称（默认：_csrf）
  cookieOptions: {
    secure: true, // 只在 HTTPS 下发送（默认：true）
    httpOnly: true, // 禁止 JavaScript 访问（默认：true）
    sameSite: "strict", // SameSite 策略（默认：strict）
  },
  tokenGenerator: () => generateRandomToken(32), // 自定义 Token 生成函数
  shouldSkip: (ctx) => ctx.path.startsWith("/api/public"), // 自定义跳过函数
}));
```

**功能特性**：
- ✅ Double Submit Cookie 模式
- ✅ 自动跳过安全方法（GET、HEAD、OPTIONS）
- ✅ 支持从请求头、表单字段、查询参数获取 Token
- ✅ 自定义 Token 生成函数
- ✅ 自定义 Cookie 选项

### 请求验证中间件

请求验证中间件，支持请求大小限制和字段验证。

```typescript
import { requestValidator } from "@dreamer/server";

server.http.use(requestValidator({
  maxBodySize: 1024 * 1024, // 请求体最大大小：1MB（默认：1MB）
  maxHeaderSize: 8 * 1024, // 请求头最大大小：8KB（默认：8KB）
  maxUrlLength: 2048, // URL 最大长度（默认：2048）
  maxQueryParams: 50, // 查询参数最大数量（默认：50）
  rules: {
    body: {
      email: {
        required: true,
        type: "string",
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        minLength: 5,
        maxLength: 100,
      },
      age: {
        type: "number",
        validate: (value) => value >= 18 ? undefined : "Must be 18 or older",
      },
    },
    query: {
      page: {
        type: "string",
        pattern: /^\d+$/,
      },
    },
  },
}));
```

**功能特性**：
- ✅ 请求大小限制（body、header、URL、查询参数数量）
- ✅ 字段验证规则（必需、类型、长度、模式）
- ✅ 自定义验证函数（支持同步和异步）
- ✅ 自定义错误格式化
- ✅ 支持 shouldSkip 配置

### 性能分析中间件

开发模式性能分析中间件，提供请求和中间件性能监控。

```typescript
import { performanceAnalyzer } from "@dreamer/server";

// 仅在开发模式使用
if (process.env.NODE_ENV === "dev") {
  server.http.use(performanceAnalyzer({
    slowRequestThreshold: 1000, // 慢请求阈值：1 秒（默认：1000ms）
    slowMiddlewareThreshold: 100, // 慢中间件阈值：100ms（默认：100ms）
    maxRecords: 1000, // 最大记录数（默认：1000）
    endpoint: "/__performance", // 性能报告端点（默认：/__performance）
    logSlowRequests: true, // 是否记录慢请求警告（默认：true）
  }));
}
```

**功能特性**：
- ✅ 自动记录所有请求的性能数据
- ✅ 检测慢请求和慢中间件
- ✅ HTML 性能报告页面（`/__performance` 端点）
- ✅ 慢请求控制台警告
- ✅ 支持自定义阈值和端点

### 请求签名验证中间件

请求签名验证中间件，使用 HMAC 签名防止请求篡改。

```typescript
import { requestSignature, generateRequestSignature } from "@dreamer/server";

// 服务端配置
server.http.use(requestSignature({
  secret: "your-secret-key", // 密钥（字符串或 CryptoKey）
  algorithm: "HS256", // HMAC 算法（HS256、HS384、HS512，默认：HS256）
  signatureHeader: "X-Request-Signature", // 签名请求头名称（默认：X-Request-Signature）
  timestampHeader: "X-Request-Timestamp", // 时间戳请求头名称（默认：X-Request-Timestamp）
  expiresIn: 300, // 签名过期时间：5 分钟（默认：300 秒）
  timestampTolerance: 60, // 时间戳容差：1 分钟（默认：60 秒）
  shouldSkip: (ctx) => ctx.path.startsWith("/public"), // 自定义跳过函数
}));

// 客户端生成签名
const { signature, timestamp } = await generateRequestSignature(
  "POST",
  "/api/users",
  { page: "1" }, // 查询参数
  { name: "Test" }, // 请求体
  "your-secret-key",
  "HS256"
);

// 发送请求
fetch("/api/users?page=1", {
  method: "POST",
  headers: {
    "X-Request-Signature": signature,
    "X-Request-Timestamp": timestamp.toString(),
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ name: "Test" }),
});
```

**功能特性**：
- ✅ HMAC 签名验证（支持 HS256、HS384、HS512）
- ✅ 签名过期时间检查
- ✅ 时间戳容差（防止时钟偏差）
- ✅ 自定义签名字段生成函数
- ✅ 客户端签名生成工具函数

### 安全头中间件（增强版）

安全头中间件，支持更多安全头和动态安全策略。

```typescript
import { securityHeaders } from "@dreamer/server";

// 使用默认配置
server.http.use(securityHeaders());

// 自定义配置
server.http.use(securityHeaders({
  // 基础安全头
  frameOptions: "SAMEORIGIN", // X-Frame-Options（默认：DENY）
  contentTypeOptions: true, // X-Content-Type-Options（默认：true）
  xssProtection: true, // X-XSS-Protection（默认：true）
  referrerPolicy: "strict-origin-when-cross-origin", // Referrer-Policy（默认：true）
  contentSecurityPolicy: "default-src 'self'", // Content-Security-Policy（默认：false）
  strictTransportSecurity: true, // Strict-Transport-Security（默认：false，仅 HTTPS）
  permissionsPolicy: "geolocation=(), microphone=()", // Permissions-Policy（默认：false）

  // 新增安全头
  crossOriginEmbedderPolicy: "require-corp", // Cross-Origin-Embedder-Policy
  crossOriginOpenerPolicy: "same-origin", // Cross-Origin-Opener-Policy
  crossOriginResourcePolicy: "same-origin", // Cross-Origin-Resource-Policy
  dnsPrefetchControl: "on", // X-DNS-Prefetch-Control
  downloadOptions: true, // X-Download-Options
  permittedCrossDomainPolicies: "none", // X-Permitted-Cross-Domain-Policies

  // 动态安全策略
  dynamicPolicy: (ctx) => {
    if (ctx.path.startsWith("/api")) {
      return { contentSecurityPolicy: false }; // API 路径禁用 CSP
    }
    return {};
  },

  // 配置验证
  validateConfig: true, // 验证安全头配置（默认：false）
}));
```

**功能特性**：
- ✅ 支持 13+ 种安全响应头
- ✅ 动态安全策略（根据请求上下文调整）
- ✅ 配置验证（警告不合理的配置组合）
- ✅ 所有安全头支持自定义值

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

- **总测试数**: 325 个测试用例
- **测试文件**: 26 个测试文件
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
