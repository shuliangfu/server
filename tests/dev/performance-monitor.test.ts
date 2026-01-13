/**
 * HMR 性能监控测试
 */

import { beforeEach, describe, expect, it } from "@dreamer/test";
import { HMRPerformanceMonitor } from "../../src/dev/performance-monitor.ts";

describe("HMR 性能监控", () => {
  describe("HMRPerformanceMonitor", () => {
    let monitor: HMRPerformanceMonitor;

    beforeEach(() => {
      monitor = new HMRPerformanceMonitor();
    });

    describe("startUpdate", () => {
      it("应该开始记录更新", () => {
        monitor.startUpdate(["file1.ts", "file2.ts"], "component-update");

        const stats = monitor.getStats();
        expect(stats.totalUpdates).toBe(0); // 还没有结束，所以不计入统计
      });

      it("应该记录更新开始时间", () => {
        monitor.startUpdate(["file1.ts"], "update");
        const recent = monitor.getRecentMetrics(1);

        expect(recent.length).toBe(0); // 还没有结束，所以没有记录
      });

      it("应该记录文件路径", () => {
        monitor.startUpdate(["file1.ts", "file2.ts"], "update");
        monitor.endUpdate(true);

        const recent = monitor.getRecentMetrics(1);
        expect(recent[0]?.filePaths).toEqual(["file1.ts", "file2.ts"]);
      });

      it("应该记录更新类型", () => {
        monitor.startUpdate(["file1.ts"], "css-update");
        monitor.endUpdate(true);

        const recent = monitor.getRecentMetrics(1);
        expect(recent[0]?.updateType).toBe("css-update");
      });
    });

    describe("endUpdate", () => {
      it("应该结束更新并记录耗时", async () => {
        monitor.startUpdate(["file1.ts"], "update");
        // 等待一小段时间
        await new Promise((resolve) => setTimeout(resolve, 10));
        monitor.endUpdate(true);

        const recent = monitor.getRecentMetrics(1);
        const metrics = recent[0];
        expect(metrics?.endTime).toBeDefined();
        expect(metrics?.duration).toBeDefined();
        expect(metrics?.duration).toBeGreaterThan(0);
        expect(metrics?.success).toBe(true);
      });

      it("应该记录失败状态", () => {
        monitor.startUpdate(["file1.ts"], "update");
        monitor.endUpdate(false, "更新失败");

        const recent = monitor.getRecentMetrics(1);
        const metrics = recent[0];
        expect(metrics?.success).toBe(false);
        expect(metrics?.error).toBe("更新失败");
      });
    });

    describe("getStats", () => {
      it("应该返回初始统计信息", () => {
        const stats = monitor.getStats();

        expect(stats.totalUpdates).toBe(0);
        expect(stats.successfulUpdates).toBe(0);
        expect(stats.failedUpdates).toBe(0);
        expect(stats.averageDuration).toBe(0);
      });

      it("应该统计成功的更新", async () => {
        monitor.startUpdate(["file1.ts"], "update");
        await new Promise((resolve) => setTimeout(resolve, 10));
        monitor.endUpdate(true);

        const stats = monitor.getStats();
        expect(stats.totalUpdates).toBe(1);
        expect(stats.successfulUpdates).toBe(1);
        expect(stats.failedUpdates).toBe(0);
      });

      it("应该统计失败的更新", () => {
        monitor.startUpdate(["file1.ts"], "update");
        monitor.endUpdate(false);

        const stats = monitor.getStats();
        expect(stats.totalUpdates).toBe(1);
        expect(stats.successfulUpdates).toBe(0);
        expect(stats.failedUpdates).toBe(1);
      });

      it("应该计算平均耗时", async () => {
        monitor.startUpdate(["file1.ts"], "update");
        await new Promise((resolve) => setTimeout(resolve, 20));
        monitor.endUpdate(true);

        monitor.startUpdate(["file2.ts"], "update");
        await new Promise((resolve) => setTimeout(resolve, 30));
        monitor.endUpdate(true);

        const stats = monitor.getStats();
        expect(stats.totalUpdates).toBe(2);
        expect(stats.averageDuration).toBeGreaterThan(0);
        expect(stats.maxDuration).toBeGreaterThanOrEqual(stats.averageDuration);
        expect(stats.minDuration).toBeLessThanOrEqual(stats.averageDuration);
      });
    });

    describe("getRecentMetrics", () => {
      it("应该返回最近的性能指标", () => {
        monitor.startUpdate(["file1.ts"], "update");
        monitor.endUpdate(true);

        const recent = monitor.getRecentMetrics(1);
        expect(recent.length).toBe(1);
        expect(recent[0]?.filePaths).toEqual(["file1.ts"]);
        expect(recent[0]?.updateType).toBe("update");
        expect(recent[0]?.moduleCount).toBe(1);
      });

      it("应该限制返回的记录数量", () => {
        for (let i = 0; i < 5; i++) {
          monitor.startUpdate([`file${i}.ts`], "update");
          monitor.endUpdate(true);
        }

        const recent = monitor.getRecentMetrics(3);
        expect(recent.length).toBe(3);
      });
    });

    describe("clear", () => {
      it("应该清除所有统计信息", async () => {
        monitor.startUpdate(["file1.ts"], "update");
        await new Promise((resolve) => setTimeout(resolve, 10));
        monitor.endUpdate(true);

        monitor.clear();

        const stats = monitor.getStats();
        expect(stats.totalUpdates).toBe(0);
        expect(stats.successfulUpdates).toBe(0);
        expect(stats.failedUpdates).toBe(0);
      });
    });
  });
});
