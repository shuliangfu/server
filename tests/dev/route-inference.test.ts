/**
 * 路由推断测试
 */

import { beforeEach, describe, expect, it } from "@dreamer/test";
import {
  createRouteInferrer,
  RouteInferrer,
} from "../../src/dev/route-inference.ts";

describe("路由推断", () => {
  describe("RouteInferrer", () => {
    let inferrer: RouteInferrer;

    beforeEach(() => {
      inferrer = createRouteInferrer();
    });

    describe("inferRoute", () => {
      it("应该从 pages 目录推断路由", () => {
        const route = inferrer.inferRoute("pages/index.tsx");
        expect(route).toBe("/");
      });

      it("应该从 pages 目录推断嵌套路由", () => {
        const route = inferrer.inferRoute("pages/about.tsx");
        expect(route).toBe("/about");
      });

      it("应该从 pages 目录推断深层嵌套路由", () => {
        const route = inferrer.inferRoute("pages/blog/post.tsx");
        expect(route).toBe("/blog/post");
      });

      it("应该从 routes 目录推断路由", () => {
        const route = inferrer.inferRoute("routes/home.tsx");
        expect(route).toBe("/home");
      });

      it("应该从 app 目录推断路由（App Router）", () => {
        const route = inferrer.inferRoute("app/dashboard/page.tsx");
        expect(route).toBe("/dashboard");
      });

      it("应该处理动态路由参数 [id]", () => {
        const route = inferrer.inferRoute("pages/user/[id].tsx");
        expect(route).toBe("/user/:id");
      });

      it("应该处理捕获所有路由 [...slug]", () => {
        const route = inferrer.inferRoute("pages/docs/[...slug].tsx");
        expect(route).toBe("/docs/*");
      });

      it("应该处理可选捕获路由 [[...slug]]", () => {
        const route = inferrer.inferRoute("pages/admin/[[...slug]].tsx");
        expect(route).toBe("/admin/*");
      });

      it("应该处理可选参数 [[id]]", () => {
        const route = inferrer.inferRoute("pages/post/[[id]].tsx");
        expect(route).toBe("/post/:id?");
      });

      it("应该移除 Next.js 路由组 (group)", () => {
        const route = inferrer.inferRoute("pages/(auth)/login.tsx");
        expect(route).toBe("/login");
      });

      it("应该规范化路径（移除 index）", () => {
        const route = inferrer.inferRoute("pages/index.tsx");
        expect(route).toBe("/");
      });

      it("应该规范化路径（移除尾随斜杠）", () => {
        const route = inferrer.inferRoute("pages/about/index.tsx");
        expect(route).toBe("/about");
      });

      it("应该处理 Windows 路径分隔符", () => {
        const route = inferrer.inferRoute("pages\\user\\profile.tsx");
        expect(route).toBe("/user/profile");
      });

      it("应该处理基础路径", () => {
        const inferrerWithBase = createRouteInferrer({
          basePath: "/project/src",
        });
        const route = inferrerWithBase.inferRoute(
          "/project/src/pages/home.tsx",
        );
        expect(route).toBe("/home");
      });

      it("应该返回 undefined（如果无法推断）", () => {
        const route = inferrer.inferRoute("utils/helper.ts");
        expect(route).toBeUndefined();
      });
    });

    describe("isLayoutFile", () => {
      it("应该识别 layout.tsx 文件", () => {
        expect(inferrer.isLayoutFile("pages/layout.tsx")).toBe(true);
      });

      it("应该识别 _layout.tsx 文件", () => {
        expect(inferrer.isLayoutFile("pages/_layout.tsx")).toBe(true);
      });

      it("应该识别 app 目录下的 layout 文件", () => {
        expect(inferrer.isLayoutFile("app/dashboard/layout.tsx")).toBe(true);
      });

      it("应该识别 layout.ts 文件", () => {
        expect(inferrer.isLayoutFile("pages/layout.ts")).toBe(true);
      });

      it("应该识别 layout.vue 文件", () => {
        expect(inferrer.isLayoutFile("pages/layout.vue")).toBe(true);
      });

      it("不应该识别普通页面文件", () => {
        expect(inferrer.isLayoutFile("pages/index.tsx")).toBe(false);
      });
    });

    describe("isPageFile", () => {
      it("应该识别 page.tsx 文件（App Router）", () => {
        expect(inferrer.isPageFile("app/dashboard/page.tsx")).toBe(true);
      });

      it("应该识别 pages 目录下的文件", () => {
        expect(inferrer.isPageFile("pages/about.tsx")).toBe(true);
      });

      it("应该识别 routes 目录下的文件", () => {
        expect(inferrer.isPageFile("routes/home.tsx")).toBe(true);
      });

      it("不应该识别 layout 文件", () => {
        expect(inferrer.isPageFile("pages/layout.tsx")).toBe(false);
      });

      it("不应该识别组件文件", () => {
        expect(inferrer.isPageFile("components/Button.tsx")).toBe(false);
      });
    });

    describe("isComponentFile", () => {
      it("应该识别 components 目录下的文件", () => {
        expect(inferrer.isComponentFile("components/Button.tsx")).toBe(true);
      });

      it("应该识别 component 目录下的文件", () => {
        expect(inferrer.isComponentFile("component/Header.tsx")).toBe(true);
      });

      it("不应该识别 layout 文件", () => {
        expect(inferrer.isComponentFile("components/layout.tsx")).toBe(false);
      });

      it("不应该识别页面文件", () => {
        expect(inferrer.isComponentFile("pages/Home.tsx")).toBe(false);
      });
    });

    describe("自定义路由映射", () => {
      it("应该支持自定义路由模式", () => {
        const customInferrer = createRouteInferrer({
          patterns: [
            {
              filePattern: /src\/(.*)\.(tsx?|jsx?)$/i,
              routeTemplate: "/$1",
            },
          ],
        });

        const route = customInferrer.inferRoute("src/home.tsx");
        expect(route).toBe("/home");
      });
    });
  });
});
