/**
 * 模块依赖图测试
 */

import { beforeEach, describe, expect, it } from "@dreamer/test";
import { ModuleGraphManager } from "../../src/dev/module-graph.ts";

describe("模块依赖图", () => {
  describe("ModuleGraphManager", () => {
    let manager: ModuleGraphManager;

    beforeEach(() => {
      manager = new ModuleGraphManager();
    });

    describe("addModule", () => {
      it("应该添加模块", () => {
        manager.addModule("module1", "/path/to/module1.ts", []);

        const affected = manager.getAffectedModules("/path/to/module1.ts");
        expect(affected).toContain("module1");
      });

      it("应该添加模块依赖关系", () => {
        manager.addModule("module1", "/path/to/module1.ts", ["module2"]);
        manager.addModule("module2", "/path/to/module2.ts", []);

        const affected = manager.getAffectedModules("/path/to/module2.ts");
        expect(affected).toContain("module2");
        expect(affected).toContain("module1");
      });

      it("应该处理多个依赖", () => {
        manager.addModule("module1", "/path/to/module1.ts", [
          "module2",
          "module3",
        ]);
        manager.addModule("module2", "/path/to/module2.ts", []);
        manager.addModule("module3", "/path/to/module3.ts", []);

        const affected2 = manager.getAffectedModules("/path/to/module2.ts");
        expect(affected2).toContain("module2");
        expect(affected2).toContain("module1");

        const affected3 = manager.getAffectedModules("/path/to/module3.ts");
        expect(affected3).toContain("module3");
        expect(affected3).toContain("module1");
      });

      it("应该处理嵌套依赖", () => {
        manager.addModule("module1", "/path/to/module1.ts", ["module2"]);
        manager.addModule("module2", "/path/to/module2.ts", ["module3"]);
        manager.addModule("module3", "/path/to/module3.ts", []);

        const affected = manager.getAffectedModules("/path/to/module3.ts");
        expect(affected).toContain("module3");
        expect(affected).toContain("module2");
        expect(affected).toContain("module1");
      });
    });

    describe("getAffectedModules", () => {
      it("应该返回受影响的模块列表", () => {
        manager.addModule("module1", "/path/to/module1.ts", ["module2"]);
        manager.addModule("module2", "/path/to/module2.ts", []);

        const affected = manager.getAffectedModules("/path/to/module2.ts");
        expect(affected.length).toBe(2);
        expect(affected).toContain("module1");
        expect(affected).toContain("module2");
      });

      it("应该返回空数组（如果文件不存在）", () => {
        const affected = manager.getAffectedModules("/nonexistent.ts");
        expect(affected.length).toBe(0);
      });

      it("应该处理循环依赖", () => {
        manager.addModule("module1", "/path/to/module1.ts", ["module2"]);
        manager.addModule("module2", "/path/to/module2.ts", ["module1"]);

        const affected1 = manager.getAffectedModules("/path/to/module1.ts");
        expect(affected1).toContain("module1");
        expect(affected1).toContain("module2");

        const affected2 = manager.getAffectedModules("/path/to/module2.ts");
        expect(affected2).toContain("module1");
        expect(affected2).toContain("module2");
      });
    });

    describe("removeModule", () => {
      it("应该移除模块", () => {
        manager.addModule("module1", "/path/to/module1.ts", []);
        const moduleId = manager.getModuleId("/path/to/module1.ts");
        if (moduleId) {
          manager.removeModule(moduleId);
        }

        const affected = manager.getAffectedModules("/path/to/module1.ts");
        expect(affected.length).toBe(0);
      });

      it("应该移除模块的依赖关系", () => {
        manager.addModule("module1", "/path/to/module1.ts", ["module2"]);
        manager.addModule("module2", "/path/to/module2.ts", []);
        const moduleId = manager.getModuleId("/path/to/module1.ts");
        if (moduleId) {
          manager.removeModule(moduleId);
        }

        const affected = manager.getAffectedModules("/path/to/module2.ts");
        expect(affected).not.toContain("module1");
        expect(affected).toContain("module2");
      });
    });

    describe("getModuleId", () => {
      it("应该根据文件路径获取模块 ID", () => {
        manager.addModule("module1", "/path/to/module1.ts", []);
        const moduleId = manager.getModuleId("/path/to/module1.ts");
        expect(moduleId).toBe("module1");
      });

      it("应该返回 undefined（如果文件不存在）", () => {
        const moduleId = manager.getModuleId("/nonexistent.ts");
        expect(moduleId).toBeUndefined();
      });
    });

    describe("getFilePath", () => {
      it("应该根据模块 ID 获取文件路径", () => {
        manager.addModule("module1", "/path/to/module1.ts", []);
        const filePath = manager.getFilePath("module1");
        expect(filePath).toBe("/path/to/module1.ts");
      });

      it("应该返回 undefined（如果模块不存在）", () => {
        const filePath = manager.getFilePath("nonexistent");
        expect(filePath).toBeUndefined();
      });
    });
  });
});
