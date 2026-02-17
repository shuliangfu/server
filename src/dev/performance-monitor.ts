/**
 * HMR 性能监控
 *
 * 记录和统计 HMR 更新的性能指标
 */

import { $t, type Locale } from "../i18n.ts";

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  // 更新开始时间
  startTime: number;
  // 更新结束时间
  endTime?: number;
  // 更新耗时（毫秒）
  duration?: number;
  // 更新的模块数量
  moduleCount: number;
  // 更新的文件路径
  filePaths: string[];
  // 更新类型
  updateType: string;
  // 是否成功
  success: boolean;
  // 错误信息（如果失败）
  error?: string;
}

/**
 * 性能统计
 */
export interface PerformanceStats {
  // 总更新次数
  totalUpdates: number;
  // 成功更新次数
  successfulUpdates: number;
  // 失败更新次数
  failedUpdates: number;
  // 平均更新耗时（毫秒）
  averageDuration: number;
  // 最长更新耗时（毫秒）
  maxDuration: number;
  // 最短更新耗时（毫秒）
  minDuration: number;
  // 总更新耗时（毫秒）
  totalDuration: number;
}

/**
 * HMR 性能监控器
 */
export class HMRPerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private currentUpdate: PerformanceMetrics | null = null;
  private readonly maxMetrics = 100; // 最多保留 100 条记录
  private readonly lang?: Locale;

  constructor(options?: { lang?: Locale }) {
    this.lang = options?.lang;
  }

  /**
   * 开始记录更新
   *
   * @param filePaths 更新的文件路径列表
   * @param updateType 更新类型
   */
  startUpdate(filePaths: string[], updateType: string): void {
    this.currentUpdate = {
      startTime: performance.now(),
      moduleCount: filePaths.length,
      filePaths,
      updateType,
      success: false,
    };
  }

  /**
   * 结束记录更新
   *
   * @param success 是否成功
   * @param error 错误信息（如果失败）
   */
  endUpdate(success: boolean, error?: string): void {
    if (!this.currentUpdate) {
      return;
    }

    const endTime = performance.now();
    this.currentUpdate.endTime = endTime;
    this.currentUpdate.duration = endTime - this.currentUpdate.startTime;
    this.currentUpdate.success = success;
    if (error) {
      this.currentUpdate.error = error;
    }

    // 保存指标
    this.metrics.push(this.currentUpdate);

    // 限制记录数量
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // 输出性能日志
    this.logPerformance(this.currentUpdate);

    // 清空当前更新
    this.currentUpdate = null;
  }

  /**
   * 获取性能统计
   *
   * @returns 性能统计信息
   */
  getStats(): PerformanceStats {
    const successfulMetrics = this.metrics.filter((m) =>
      m.success && m.duration
    );
    const durations = successfulMetrics.map((m) => m.duration!);

    return {
      totalUpdates: this.metrics.length,
      successfulUpdates: successfulMetrics.length,
      failedUpdates: this.metrics.length - successfulMetrics.length,
      averageDuration: durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      totalDuration: durations.reduce((a, b) => a + b, 0),
    };
  }

  /**
   * 获取最近的性能指标
   *
   * @param count 返回的记录数量
   * @returns 性能指标列表
   */
  getRecentMetrics(count: number = 10): PerformanceMetrics[] {
    return this.metrics.slice(-count).reverse();
  }

  /**
   * 清空所有指标
   */
  clear(): void {
    this.metrics = [];
    this.currentUpdate = null;
  }

  /**
   * 输出性能日志
   *
   * @param metrics 性能指标
   */
  private logPerformance(metrics: PerformanceMetrics): void {
    if (!metrics.success && metrics.error) {
      console.error(
        $t("hmrPerformance.error", { message: metrics.error }, this.lang),
      );
    }
  }
}

/**
 * 创建性能监控器实例
 *
 * @param options 可选配置（如 lang 用于日志文案）
 * @returns 性能监控器实例
 */
export function createPerformanceMonitor(
  options?: { lang?: Locale },
): HMRPerformanceMonitor {
  return new HMRPerformanceMonitor(options);
}
