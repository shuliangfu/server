# @dreamer/server

> Unified HTTP server library compatible with Deno and Bun. Full server support
> for both development and production.

English | [中文 (Chinese)](./docs/zh-CN/README.md)

[![JSR](https://jsr.io/badges/@dreamer/server)](https://jsr.io/@dreamer/server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE.md)
[![Tests](https://img.shields.io/badge/tests-143%20passed-brightgreen)](./docs/en-US/TEST_REPORT.md)

---

## 🎯 Features

Unified HTTP server library combining HTTP core, dev tools (HMR, file watching),
and production server features.

## ✨ Capabilities

### HTTP Server Core

- ✅ **Full HTTP application**:
  - HTTP server (via @dreamer/runtime-adapter)
  - Middleware integration (@dreamer/middleware)
  - Routing integration (@dreamer/router)
  - Cookie management (parse and set)
  - Error handling and logging (@dreamer/logger)
  - WebSocket support (for HMR, etc.)

### Dev Server

- ✅ **HMR hot reload**:
  - WebSocket server (browser communication)
  - File watching (source changes)
  - Incremental build integration
  - Client script injection (HMR client)

- ✅ **Dev tools**:
  - File watching (auto watch source)
  - Build integration (@dreamer/esbuild)
  - Fast refresh

### Production Server

- ✅ **Production optimizations**:
  - Static file serving (build output)
  - Performance tuning
  - Error handling optimizations

---

## 📦 Installation

```bash
deno add jsr:@dreamer/server
```

---

## 🌍 Environment Compatibility

- **Runtime**: Deno 2.6+ or Bun 1.3.5
- **Server**: ✅ Supported (Deno and Bun)

---

## 🚀 Quick Start

### Dev server

```typescript
import { Server } from "@dreamer/server";
import { bodyParser, compression, cors } from "@dreamer/server";

const server = new Server({
  mode: "dev",
  port: 3000,
  dev: {
    hmr: true,
    watch: ["./src"],
    builder: {
      async rebuild() {
        return { outputFiles: [] };
      },
    },
  },
});

server.http.use(cors({ origin: "*" }));
server.http.use(bodyParser());
server.http.use(compression({ enableBrotli: true }));

server.http.use(async (ctx, next) => {
  if (ctx.path === "/") {
    ctx.response = new Response("Hello, World!");
    return;
  }
  await next();
});

await server.start();
```

**Debug and logging**: For request order, path pre-handlers, middleware chain,
etc., pass `debug: true` and a custom `logger` (with level `"debug"`). Debug
output goes to `logger.debug`:

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

### Production server

```typescript
import { Server } from "@dreamer/server";
import { bodyParser, compression, cors, staticFiles } from "@dreamer/server";

const server = new Server({
  mode: "prod",
  port: 8000,
});

server.http.use(cors({ origin: "*" }));
server.http.use(bodyParser());
server.http.use(compression({ enableBrotli: true }));
server.http.use(staticFiles({ root: "./dist", prefix: "/static" }));

server.http.use(async (ctx, next) => {
  if (ctx.path === "/") {
    ctx.response = new Response("Hello, World!");
    return;
  }
  await next();
});

await server.start();
```

---

## 📖 API Reference

### Server class

#### Constructor

```typescript
new Server(options?: ServerOptions)
```

**Parameters**:

- `options.mode?: "dev" | "prod"` - Server mode (default: `"prod"`)
- `options.port?: number` - Port (default: 3000 dev, 8000 prod)
- `options.host?: string` - Host (default: `"localhost"`)
- `options.onListen?: (params: { host: string; port: number }) => void` - Listen
  callback
- `options.onError?: (error: Error) => Response | Promise<Response>` - Error
  handler
- `options.logger?: Logger` - Logger instance (default logger if not provided)
- `options.debug?: boolean` - Enable debug logs (default: `false`), outputs
  path, pre-handlers, middleware chain, response status via `logger.debug`
- `options.dev?: DevConfig` - Dev config (dev mode only)

#### Methods

- `start(): Promise<void>` - Start server
- `stop(): Promise<void>` - Stop server

#### Properties

- `http: Http` - HTTP app instance (middleware, routes, etc.)
- `port: number` - Port (read-only)
- `host: string` - Host (read-only)

### DevConfig

```typescript
interface DevConfig {
  hmr?: HMRConfig | boolean;
  watch?: WatchConfig | string[];
  builder?: {
    rebuild(): Promise<
      { outputFiles?: Array<{ path: string; contents: Uint8Array }> }
    >;
  };
}
```

### HMRConfig

```typescript
interface HMRConfig {
  enabled?: boolean;
  path?: string;
  clientScript?: string;
}
```

### WatchConfig

```typescript
interface WatchConfig {
  paths?: string[];
  ignore?: string[];
  options?: {
    recursive?: boolean;
  };
}
```

---

## 🔌 Router Integration

```typescript
import { Server } from "@dreamer/server";
import { createRouter } from "@dreamer/router";

const server = new Server({
  mode: "dev",
  port: 3000,
});

const router = createRouter({
  routesDir: "./src/routes",
  apiMode: "restful",
});
await router.scan();

server.http.useRouter(router);

await server.start();
```

---

## 🔄 HMR Usage

### Basic config

```typescript
const server = new Server({
  mode: "dev",
  port: 3000,
  dev: {
    hmr: true,
    watch: ["./src"],
    builder: {
      async rebuild() {
        return { outputFiles: [] };
      },
    },
  },
});
```

### Custom HMR path

```typescript
const server = new Server({
  mode: "dev",
  port: 3000,
  dev: {
    hmr: {
      enabled: true,
      path: "/__hmr",
    },
    watch: ["./src"],
  },
});
```

---

## 📝 Full Examples

### Dev server example

```typescript
import {
  bodyParser,
  compression,
  cors,
  errorHandler,
  performanceAnalyzer,
  requestId,
  requestLogger,
  Server,
} from "@dreamer/server";
import { createRouter } from "@dreamer/router";

const server = new Server({
  mode: "dev",
  port: 3000,
  dev: {
    hmr: true,
    watch: ["./src"],
    builder: {
      async rebuild() {
        return { outputFiles: [] };
      },
    },
  },
});

server.http.use(cors({ origin: "*" }));
server.http.use(requestId());
server.http.use(bodyParser());
server.http.use(compression({ enableBrotli: true }));
server.http.use(requestLogger());
server.http.use(performanceAnalyzer());
server.http.useError(errorHandler({
  isDev: true,
  provideSuggestions: true,
}));

const router = createRouter({
  routesDir: "./src/routes",
  apiMode: "restful",
});
await router.scan();
server.http.useRouter(router);

await server.start();
```

### Production server example

```typescript
import {
  bodyParser,
  compression,
  cors,
  csrf,
  errorHandler,
  metrics,
  requestId,
  responseCache,
  securityHeaders,
  Server,
  staticFiles,
} from "@dreamer/server";

const server = new Server({
  mode: "prod",
  port: 8000,
});

server.http.use(cors({ origin: "https://example.com" }));
server.http.use(requestId());
server.http.use(securityHeaders());
server.http.use(csrf());
server.http.use(bodyParser());
server.http.use(compression({ enableBrotli: true }));
server.http.use(metrics());
server.http.use(responseCache());
server.http.use(staticFiles({
  root: "./dist",
  prefix: "/static",
  enableCache: true,
}));
server.http.useError(errorHandler());

server.http.use(async (ctx, next) => {
  if (ctx.path === "/") {
    ctx.response = new Response("Hello, World!");
    return;
  }
  await next();
});

await server.start();
```

## 📊 Test Coverage

- **Total tests**: 143
- **Test files**: 10
- **Pass rate**: 100% ✅
- **Details**: [TEST_REPORT.md](./docs/en-US/TEST_REPORT.md)
- **Changelog**: [CHANGELOG.md](./docs/en-US/CHANGELOG.md)

### Changelog (latest)

**v1.0.4** (2026-02-10): Added HMR `routePath` in broadcast and
`__HMR_REFRESH__` callback for fine-grained route-level HMR; refresh hook
renamed to `__HMR_REFRESH__`. [Full changelog](./docs/en-US/CHANGELOG.md)

---

## 🤝 Contributing

Issues and Pull Requests are welcome.

---

## 📄 License

MIT License - see [LICENSE.md](./LICENSE.md)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
