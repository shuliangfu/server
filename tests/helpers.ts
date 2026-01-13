/**
 * 测试辅助函数
 */

import { CookieManager } from "../src/cookie.ts";
import type { HttpContext } from "../src/context.ts";

/**
 * 创建测试用的 HttpContext
 *
 * @param request 请求对象
 * @param response 响应对象（可选）
 * @returns HttpContext 对象
 */
export function createTestContext(
  request: Request,
  response?: Response,
): HttpContext {
  const url = new URL(request.url);
  const cookieManager = new CookieManager(request.headers.get("Cookie") || "");

  return {
    request,
    response: response || new Response(),
    state: {},
    cookies: {
      get: (name: string) => cookieManager.get(name),
      set: (name: string, value: string, options?) => {
        cookieManager.set(name, value, options);
      },
      remove: (name: string) => cookieManager.remove(name),
      getAll: () => cookieManager.getAll(),
    },
    path: url.pathname,
    method: request.method,
    url,
    headers: request.headers,
    query: Object.fromEntries(url.searchParams),
  };
}
