/**
 * 模块依赖图管理
 *
 * 用于跟踪模块之间的依赖关系，精确计算受影响的模块
 */

/**
 * 模块依赖图
 */
export interface ModuleGraph {
  // 模块 ID -> 依赖的模块 ID 列表（正向依赖）
  dependencies: Map<string, Set<string>>;
  // 模块 ID -> 依赖此模块的模块 ID 列表（反向依赖）
  dependents: Map<string, Set<string>>;
  // 模块 ID -> 文件路径
  moduleToFile: Map<string, string>;
  // 文件路径 -> 模块 ID
  fileToModule: Map<string, string>;
}

/**
 * 模块依赖图管理器
 */
export class ModuleGraphManager {
  private graph: ModuleGraph;

  constructor() {
    this.graph = {
      dependencies: new Map(),
      dependents: new Map(),
      moduleToFile: new Map(),
      fileToModule: new Map(),
    };
  }

  /**
   * 添加模块依赖关系
   *
   * @param moduleId 模块 ID
   * @param filePath 文件路径
   * @param dependencies 依赖的模块 ID 列表
   */
  addModule(
    moduleId: string,
    filePath: string,
    dependencies: string[] = [],
  ): void {
    // 记录模块与文件的映射
    this.graph.moduleToFile.set(moduleId, filePath);
    this.graph.fileToModule.set(filePath, moduleId);

    // 更新依赖关系
    const existingDeps = this.graph.dependencies.get(moduleId) || new Set();
    for (const dep of dependencies) {
      existingDeps.add(dep);

      // 更新反向依赖
      const dependents = this.graph.dependents.get(dep) || new Set();
      dependents.add(moduleId);
      this.graph.dependents.set(dep, dependents);
    }
    this.graph.dependencies.set(moduleId, existingDeps);
  }

  /**
   * 移除模块
   *
   * @param moduleId 模块 ID
   */
  removeModule(moduleId: string): void {
    const filePath = this.graph.moduleToFile.get(moduleId);
    if (filePath) {
      this.graph.fileToModule.delete(filePath);
    }
    this.graph.moduleToFile.delete(moduleId);

    // 移除依赖关系
    const deps = this.graph.dependencies.get(moduleId);
    if (deps) {
      for (const dep of deps) {
        const dependents = this.graph.dependents.get(dep);
        if (dependents) {
          dependents.delete(moduleId);
          if (dependents.size === 0) {
            this.graph.dependents.delete(dep);
          }
        }
      }
      this.graph.dependencies.delete(moduleId);
    }

    // 移除反向依赖
    const dependents = this.graph.dependents.get(moduleId);
    if (dependents) {
      for (const dependent of dependents) {
        const deps = this.graph.dependencies.get(dependent);
        if (deps) {
          deps.delete(moduleId);
          if (deps.size === 0) {
            this.graph.dependencies.delete(dependent);
          }
        }
      }
      this.graph.dependents.delete(moduleId);
    }
  }

  /**
   * 根据文件路径获取模块 ID
   *
   * @param filePath 文件路径
   * @returns 模块 ID，如果不存在则返回 undefined
   */
  getModuleId(filePath: string): string | undefined {
    return this.graph.fileToModule.get(filePath);
  }

  /**
   * 根据模块 ID 获取文件路径
   *
   * @param moduleId 模块 ID
   * @returns 文件路径，如果不存在则返回 undefined
   */
  getFilePath(moduleId: string): string | undefined {
    return this.graph.moduleToFile.get(moduleId);
  }

  /**
   * 计算受影响的模块
   *
   * 当某个文件变化时，计算所有需要更新的模块（包括直接依赖和间接依赖）
   *
   * @param changedFile 变化的文件路径
   * @returns 受影响的模块 ID 列表
   */
  getAffectedModules(changedFile: string): string[] {
    const moduleId = this.getModuleId(changedFile);
    if (!moduleId) {
      // 如果文件不在依赖图中，返回空数组
      return [];
    }

    const affected = new Set<string>();
    const visited = new Set<string>();

    /**
     * 递归收集所有依赖此模块的模块（向上传播）
     *
     * @param id 模块 ID
     */
    const collectDependents = (id: string): void => {
      if (visited.has(id)) {
        return;
      }
      visited.add(id);
      affected.add(id);

      const dependents = this.graph.dependents.get(id);
      if (dependents) {
        for (const dependent of dependents) {
          collectDependents(dependent);
        }
      }
    };

    // 从变化的模块开始，向上传播收集所有依赖它的模块
    collectDependents(moduleId);

    return Array.from(affected);
  }

  /**
   * 获取模块的直接依赖
   *
   * @param moduleId 模块 ID
   * @returns 直接依赖的模块 ID 列表
   */
  getDependencies(moduleId: string): string[] {
    const deps = this.graph.dependencies.get(moduleId);
    return deps ? Array.from(deps) : [];
  }

  /**
   * 获取依赖此模块的模块（反向依赖）
   *
   * @param moduleId 模块 ID
   * @returns 依赖此模块的模块 ID 列表
   */
  getDependents(moduleId: string): string[] {
    const dependents = this.graph.dependents.get(moduleId);
    return dependents ? Array.from(dependents) : [];
  }

  /**
   * 清空依赖图
   */
  clear(): void {
    this.graph.dependencies.clear();
    this.graph.dependents.clear();
    this.graph.moduleToFile.clear();
    this.graph.fileToModule.clear();
  }

  /**
   * 获取依赖图快照（用于调试）
   *
   * @returns 依赖图的 JSON 表示
   */
  getSnapshot(): {
    dependencies: Record<string, string[]>;
    dependents: Record<string, string[]>;
    moduleToFile: Record<string, string>;
    fileToModule: Record<string, string>;
  } {
    return {
      dependencies: Object.fromEntries(
        Array.from(this.graph.dependencies.entries()).map(([k, v]) => [
          k,
          Array.from(v),
        ]),
      ),
      dependents: Object.fromEntries(
        Array.from(this.graph.dependents.entries()).map(([k, v]) => [
          k,
          Array.from(v),
        ]),
      ),
      moduleToFile: Object.fromEntries(this.graph.moduleToFile.entries()),
      fileToModule: Object.fromEntries(this.graph.fileToModule.entries()),
    };
  }
}
