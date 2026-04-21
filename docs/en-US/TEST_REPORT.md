# @dreamer/server Test Report

## 📊 Test Overview

- **Test Library Version**: @dreamer/test@^1.1.7
- **Test Framework**: @dreamer/test (compatible with Deno and Bun)
- **Test Date**: 2026-04-21
- **Test Environment**:
  - Deno 2.6+
  - Bun 1.3.5

## 📈 Test Results

### Overall Statistics

- **Total Tests (Deno)**: 175 (`deno test -A tests/`)
- **Passed**: 175 ✅
- **Failed**: 0
- **Pass Rate**: 100% ✅
- **Test Files**: 13

### Bun

- **`bun test tests/`**: 163 passed, 0 failed (same **13** test files). Minor
  count differences vs Deno come from the test runner implementation; both runs
  are green.

### Test File Statistics

| Module        | Test File                         | Tests | Status        |
| ------------- | --------------------------------- | ----- | ------------- |
| **Core**      |                                   |       |               |
|               | `context.test.ts`                 | 7     | ✅ All passed |
|               | `cookie.test.ts`                  | 20    | ✅ All passed |
|               | `create-server-response.test.ts`  | 14    | ✅ All passed |
|               | `http.test.ts`                    | 18    | ✅ All passed |
|               | `i18n.test.ts`                    | 5     | ✅ All passed |
|               | `mod.test.ts`                     | 16    | ✅ All passed |
|               | `port-utils.test.ts`              | 9     | ✅ All passed |
|               | `req-context.test.ts`             | 8     | ✅ All passed |
|               | `router-adapter.test.ts`          | 10    | ✅ All passed |
| **Dev Tools** |                                   |       |               |
|               | `dev/hmr-client.test.ts`          | 9     | ✅ All passed |
|               | `dev/module-graph.test.ts`        | 14    | ✅ All passed |
|               | `dev/performance-monitor.test.ts` | 14    | ✅ All passed |
|               | `dev/route-inference.test.ts`     | 31    | ✅ All passed |

### Note

- **Middleware tests**: Migrated to
  [@dreamer/middlewares](https://jsr.io/@dreamer/middlewares). This library
  re-exports middleware API for backward compatibility.

## 🔍 Functional Test Details

### 1. Core Modules

#### 1.1 HTTP Context (context.test.ts) - 7 tests

- ✅ HTTP context creation and property access
- ✅ Cookie manager integration, state management, query param parsing
- ✅ Path, method, URL access

#### 1.2 Cookie Management (cookie.test.ts) - 20 tests

- ✅ parseCookie / serializeCookie / CookieManager full flow

#### 1.3 Server Response Helper (create-server-response.test.ts) - 14 tests

- ✅ **`createServerResponse()`**: **`redirect`** (default and custom status),
  **`json`** (**`{ success, data }`** envelope, undefined payload, status
  **299** vs **300**), **`html`**, **`text`**, **`binary`** (Uint8Array /
  ArrayBuffer), **`body`**, **`status`**

#### 1.4 HTTP Application (http.test.ts) - 18 tests

- ✅ Http construction, middleware registration, routing integration, error
  handling, request/response handling, graceful shutdown

#### 1.5 Main Module (mod.test.ts) - 16 tests

- ✅ Server class, type exports, middleware/routing/error handler registration

#### 1.6 Server i18n (i18n.test.ts) - 5 tests

- ✅ **`setServerLocale`**, **`$tr`** (EN/ZH strings, temporary **`lang`**
  argument, placeholder interpolation)

#### 1.7 Router Adapter (router-adapter.test.ts) - 10 tests

- ✅ RouterAdapter instance, route matching, dynamic params, API context shape,
  **`apiMode`**, REST vs action resolution, POST JSON **`body`** injection

#### 1.8 Request Context Helpers (req-context.test.ts) - 8 tests

- ✅ **`pathnameFromHref`**, **`searchFromHref`**, **`resolveRequestId`**,
  **`resolveClientIp`**, **`snapshotMatchedRoute`**, **`buildApiRouteContext`**
  extensions

#### 1.9 Port Detection & Occupancy (port-utils.test.ts) - 9 tests

- ✅ isPortInUse: returns false when port is free, true when port is in use
- ✅ findAvailablePort: returns startPort when free; returns startPort+1 when
  startPort in use; returns first available when multiple consecutive ports in
  use; throws when no port found within maxAttempts
- ✅ Server start: when configured port is in use, uses port+1 and server.port
  reflects actual port; when port is free, listens on configured port

### 2. Dev Tools

#### 2.1 HMR Client (dev/hmr-client.test.ts) - 9 tests

- ✅ injectHMRClient, generateHMRClientScript

#### 2.2 Route Inference (dev/route-inference.test.ts) - 31 tests

- ✅ Route inference, Layout/page/component file detection, custom patterns

#### 2.3 Module Dependency Graph (dev/module-graph.test.ts) - 14 tests

- ✅ Module management, dependency tracking, removal and queries

#### 2.4 Performance Monitor (dev/performance-monitor.test.ts) - 14 tests

- ✅ Update records, statistics, performance metrics, data cleanup

## 📊 Test Quality

- ✅ **Feature coverage**: Core and dev tools both tested
- ✅ **Edge cases and errors**: Boundary and error handling covered
- ✅ **Resource cleanup**: Tests clean up resources correctly
- ✅ **Cross-runtime**: Passes on Deno and Bun

## 🔧 Known Issues

None. All tests pass.

## 📝 Conclusion

✅ **All 175 Deno tests passed (100% pass rate)**

✅ **Port occupancy**: Port detection (isPortInUse, findAvailablePort) and
Server auto port+1 on conflict are covered by port-utils.test.ts

✅ **Middleware**: Implementation and tests migrated to @dreamer/middlewares;
this library re-exports for compatibility

**@dreamer/server is production-ready.**

---

_Last updated: 2026-04-21_
