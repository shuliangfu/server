# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.0.2] - 2026-02-11

### Added

- **Port detection**: `isPortInUse(port)`,
  `findAvailablePort(startPort, options)`; Server automatically uses next
  available port when configured port is in use

### Changed

- **Docs**: Changelog and test report moved to `docs/en-US/` and `docs/zh-CN/`;
  added Chinese CHANGELOG and TEST_REPORT

---

## [1.0.1] - 2026-02-07

### Added

- **HMR panel i18n**: zh/en based on `document.documentElement.lang` or
  `navigator.language`
- **MutationObserver**: Watch `lang` attribute changes, auto-refresh HMR UI when
  language switches (no i18n library required)

### Fixed

- **disconnect() memory leak**: Remove `visibilitychange` and `DOMContentLoaded`
  listeners, call `statusUI.destroy()` (including MutationObserver disconnect)
  when programmatically disconnecting HMR

---

## [1.0.0] - 2026-02-06

### Added

First stable release. Unified HTTP server library compatible with Deno and Bun.
Full server support for development (HMR, file watching) and production.

#### Server Core

- **Server class**: Dev and prod modes, `start()`, `stop()`, `http` property for
  middleware and routes
- **Http class**: Middleware registration, routing integration, error handling,
  request/response handling, graceful shutdown
- **serve function**: Low-level HTTP server (via @dreamer/runtime-adapter)
- **Options**: `mode`, `port`, `host`, `onListen`, `onError`, `logger`, `debug`,
  `dev`

#### HTTP Context & Cookie

- **HttpContext**: Path, method, headers, body, state, response, error
- **CookieManager**: Parse and set cookies, integration with HttpContext
- **parseCookie** / **serializeCookie**: Cookie parsing and serialization
- **Types**: `CookieOptions`, `HttpError`

#### Router Integration

- **RouterAdapter**: Route matching, dynamic params, SSR render callback
- **useRouter**: Integrate @dreamer/router with Http
- **Types**: `RouterAdapterOptions`, `SSRRenderCallback`

#### Dev Tools

- **HMR**: WebSocket server, client script injection (`injectHMRClient`,
  `generateHMRClientScript`)
- **File watching**: Watch source changes, configurable paths and ignore
- **Route inference**: Layout/page/component file detection, custom patterns
- **Module graph**: Dependency tracking, module management
- **Performance monitor**: Update records, statistics, metrics, cleanup
- **DevConfig**: `hmr`, `watch`, `builder` (incremental build)

#### Middleware & Router Re-exports

- Re-export middleware API from @dreamer/middlewares for backward compatibility
- Re-export types: `Middleware`, `MiddlewareChain`, `MiddlewareContext` from
  @dreamer/middleware
- Re-export types: `RouteMatch`, `Router` from @dreamer/router

#### Type Exports

- `DevConfig`, `HMRConfig`, `ServerMode`, `ServerOptions`, `WatchConfig`
- `HttpServerOptions`, `PathHandler`
- `CookieOptions`, `HttpContext`, `HttpError`
