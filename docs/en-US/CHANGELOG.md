# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.0.9] - 2026-02-19

### Changed

- **i18n**: i18n now initializes automatically when the i18n module is loaded;
  `initServerI18n` is no longer exported. Removed explicit `initServerI18n()`
  call from `mod.ts`. `$tr` and `setServerLocale` still ensure init when called.
- **Dependencies**: Bumped @dreamer/console, @dreamer/render,
  @dreamer/middleware, @dreamer/router, @dreamer/runtime-adapter, @dreamer/test,
  @dreamer/esbuild.

---

## [1.0.8] - 2026-02-19

### Changed

- **i18n**: Renamed translation method from `$t` to `$tr` to avoid conflict with
  global `$t`. Update existing code to use `$tr` for package messages.

---

## [1.0.7] - 2026-02-17

### Changed

- **i18n**: Init at entry only; `initServerI18n()` is called once in `mod.ts`.
  `$t()` no longer calls `ensureServerI18n()` or sets locale internally.
- **Dependencies**: Updated JSR dependencies (e.g. @dreamer/console,
  @dreamer/esbuild).

---

## [1.0.6] - 2026-02-17

### Added

- **Server-side i18n**: Optional `lang` in `ServerOptions`, `DevConfig`, and
  `HttpServerOptions` (e.g. `"en-US"`, `"zh-CN"`). When omitted, locale is
  auto-detected from env (`LANGUAGE` / `LC_ALL` / `LANG`). All server-side
  messages (logs, errors, 404/503 response body, HMR/build messages, port
  detection) are translated. New `src/i18n.ts` and `src/locales/en-US.json`,
  `zh-CN.json`.

### Changed

- **Docs**: README and zh-CN README document the `lang` option and server-side
  i18n in features and API sections.

---

## [1.0.5] - 2026-02-10

### Changed

- **PathHandler**: `PathHandler.handler` may return `null` or `undefined` to
  skip handling; the request is then passed to the next path handler or the
  middleware chain (previously the return type was
  `Response | Promise<Response>` only).

---

## [1.0.4] - 2026-02-10

### Added

- **HMR routePath**: DevTools broadcast and HMR browser client now include
  `routePath` (route path for the updated chunk) in update messages and pass it
  to the app-registered `__HMR_REFRESH__` callback together with `chunkUrl`,
  enabling fine-grained route-level HMR in view/dweb.

### Changed

- **HMR refresh hook name**: The global callback for seamless HMR updates is now
  documented and invoked as `__HMR_REFRESH__` (replacing the previous
  `__DWEB_HMR_REFRESH__` name).

---

## [1.0.3] - 2026-02-10

### Fixed

- **HMR not starting when using Server with static middleware**: Register HMR
  WebSocket and injection middleware in DevTools constructor (instead of in
  `start()`), so the injection middleware runs before `staticFiles` and can
  inject the HMR client script into HTML responses. Call
  `devTools.start(actualPort)` before `listen()` so the client script uses the
  correct port.

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
