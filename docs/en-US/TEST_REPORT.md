# @dreamer/server Test Report

## 📊 Test Overview

- **Test Library Version**: @dreamer/test@^1.0.0-beta.40
- **Test Framework**: @dreamer/test (compatible with Deno and Bun)
- **Test Date**: 2026-02-11
- **Test Environment**:
  - Deno 2.6+
  - Bun 1.3.5

## 📈 Test Results

### Overall Statistics

- **Total Tests**: 143
- **Passed**: 143 ✅
- **Failed**: 0
- **Pass Rate**: 100% ✅
- **Test Files**: 10

### Test File Statistics

| Module        | Test File                         | Tests | Status        |
| ------------- | --------------------------------- | ----- | ------------- |
| **Core**      |                                   |       |               |
|               | `context.test.ts`                 | 7     | ✅ All passed |
|               | `cookie.test.ts`                  | 20    | ✅ All passed |
|               | `http.test.ts`                    | 18    | ✅ All passed |
|               | `mod.test.ts`                     | 16    | ✅ All passed |
|               | `router-adapter.test.ts`          | 5     | ✅ All passed |
|               | `port-utils.test.ts`              | 9     | ✅ All passed |
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

#### 1.3 HTTP Application (http.test.ts) - 18 tests

- ✅ Http construction, middleware registration, routing integration, error
  handling, request/response handling, graceful shutdown

#### 1.4 Main Module (mod.test.ts) - 16 tests

- ✅ Server class, type exports, middleware/routing/error handler registration

#### 1.5 Router Adapter (router-adapter.test.ts) - 5 tests

- ✅ RouterAdapter instance, route matching, dynamic params

#### 1.6 Port Detection & Occupancy (port-utils.test.ts) - 9 tests

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

✅ **All 143 tests passed, 100% pass rate**

✅ **Port occupancy**: Port detection (isPortInUse, findAvailablePort) and
Server auto port+1 on conflict are covered by port-utils.test.ts

✅ **Middleware**: Implementation and tests migrated to @dreamer/middlewares;
this library re-exports for compatibility

**@dreamer/server is production-ready.**

---

_Last updated: 2026-02-11_
