# @dreamer/server 测试报告

## 📊 测试概览

- **测试库版本**: @dreamer/test@^1.0.0-beta.12
- **测试框架**: @dreamer/test (兼容 Deno 和 Bun)
- **测试时间**: 2026-01-11
- **测试环境**:
  - Deno 2.6.4
  - Bun 1.3.5

## 📈 测试结果

### 总体统计

- **总测试数**: 325
- **通过**: 325 ✅
- **失败**: 0
- **通过率**: 100% ✅
- **测试文件数**: 26

### 测试文件统计

| 模块 | 测试文件 | 测试数 | 状态 |
|------|---------|--------|------|
| **核心模块** | | | |
| | `context.test.ts` | 6 | ✅ 全部通过 |
| | `cookie.test.ts` | 19 | ✅ 全部通过 |
| | `http.test.ts` | 17 | ✅ 全部通过 |
| | `mod.test.ts` | 15 | ✅ 全部通过 |
| | `router-adapter.test.ts` | 5 | ✅ 全部通过 |
| **中间件** | | | |
| | `body-parser.test.ts` | 7 | ✅ 全部通过 |
| | `compression.test.ts` | 7 | ✅ 全部通过 |
| | `cors.test.ts` | 8 | ✅ 全部通过 |
| | `csrf.test.ts` | 15 | ✅ 全部通过 |
| | `error-handler.test.ts` | 10 | ✅ 全部通过 |
| | `health-check.test.ts` | 7 | ✅ 全部通过 |
| | `metrics.test.ts` | 18 | ✅ 全部通过 |
| | `performance-analyzer.test.ts` | 13 | ✅ 全部通过 |
| | `rate-limit.test.ts` | 12 | ✅ 全部通过 |
| | `request-id.test.ts` | 11 | ✅ 全部通过 |
| | `request-logger.test.ts` | 5 | ✅ 全部通过 |
| | `request-signature.test.ts` | 17 | ✅ 全部通过 |
| | `request-validator.test.ts` | 15 | ✅ 全部通过 |
| | `response-cache.test.ts` | 20 | ✅ 全部通过 |
| | `security-headers.test.ts` | 14 | ✅ 全部通过 |
| | `static-files.test.ts` | 14 | ✅ 全部通过 |
| | `timeout.test.ts` | 5 | ✅ 全部通过 |
| **开发工具** | | | |
| | `dev/hmr-client.test.ts` | 8 | ✅ 全部通过 |
| | `dev/module-graph.test.ts` | 13 | ✅ 全部通过 |
| | `dev/performance-monitor.test.ts` | 13 | ✅ 全部通过 |
| | `dev/route-inference.test.ts` | 31 | ✅ 全部通过 |

## 🔍 功能测试详情

### 1. 核心模块

#### 1.1 HTTP 上下文 (context.test.ts) - 6 个测试

**测试场景**:
- ✅ HTTP 上下文创建和属性访问
- ✅ Cookie 管理器集成
- ✅ 状态管理
- ✅ 查询参数解析
- ✅ 路径和方法访问
- ✅ URL 对象访问

#### 1.2 Cookie 管理 (cookie.test.ts) - 19 个测试

**测试场景**:
- ✅ `parseCookie` 函数
  - 解析简单 cookie 字符串
  - 解析多个 cookie
  - 处理带空格的 cookie
  - 处理 URL 编码的值
  - 处理空字符串
  - 处理只有键没有值的 cookie
- ✅ `serializeCookie` 函数
  - 序列化简单的 cookie
  - 序列化带选项的 cookie（Max-Age、Path、Domain、Secure、HttpOnly、SameSite）
  - 处理 URL 编码的值
  - 处理 SameSite 选项（None、Lax、Strict）
- ✅ `CookieManager` 类
  - 创建实例
  - 设置和获取 cookie
  - 删除 cookie
  - 获取所有 cookie
  - 设置带选项的 cookie
  - 应用到响应头
  - 从请求头解析 cookie

#### 1.3 HTTP 应用类 (http.test.ts) - 17 个测试

**测试场景**:
- ✅ Http 类构造函数
  - 使用默认配置创建实例
  - 使用自定义配置创建实例
- ✅ 中间件注册
  - 注册单个中间件
  - 注册多个中间件（验证执行顺序）
  - 注册带条件的中间件
  - 注册带名称的中间件
- ✅ 路由集成
  - 集成路由系统
- ✅ 错误处理
  - 注册错误处理中间件
- ✅ 请求处理
  - 处理 GET 请求
  - 处理 POST 请求
  - 处理带查询参数的请求
  - 处理带路径参数的请求
  - 处理不匹配的路由
- ✅ 响应处理
  - 返回 JSON 响应
  - 返回文本响应
  - 返回 HTML 响应
  - 设置响应状态码
  - 设置响应头

#### 1.4 主模块 (mod.test.ts) - 15 个测试

**测试场景**:
- ✅ 类型导出
  - 导出 Server 类
  - 支持所有服务器模式（dev、prod）
- ✅ Server 类构造函数
  - 使用默认配置创建服务器
  - 使用自定义配置创建服务器
  - 开发模式默认端口 3000
  - 生产模式默认端口 8000
  - 支持自定义关闭超时时间
- ✅ 属性访问
  - 访问 port 属性
  - 访问 host 属性
  - 访问 http 属性
- ✅ 中间件注册
  - 注册中间件
  - 注册带条件的中间件
  - 注册带名称的中间件
- ✅ 路由集成
  - 集成路由系统
- ✅ 错误处理
  - 注册错误处理中间件

#### 1.5 路由适配器 (router-adapter.test.ts) - 5 个测试

**测试场景**:
- ✅ RouterAdapter 类
  - 创建实例
  - 匹配路由
  - 处理路由参数
  - 处理查询参数
  - 处理不匹配的路由

### 2. 中间件模块

#### 2.1 请求体解析中间件 (body-parser.test.ts) - 7 个测试

**测试场景**:
- ✅ 解析 JSON 请求体
- ✅ 解析 URL 编码请求体
- ✅ 解析文本请求体
- ✅ 处理空请求体
- ✅ 处理无效 JSON
- ✅ 支持自定义内容类型
- ✅ 支持大小限制

#### 2.2 响应压缩中间件 (compression.test.ts) - 7 个测试

**测试场景**:
- ✅ 创建压缩中间件
- ✅ 压缩支持 gzip 的响应
- ✅ 压缩支持 brotli 的响应
- ✅ 不压缩不支持压缩的响应
- ✅ 支持自定义压缩级别
- ✅ 支持文件类型过滤
- ✅ 支持大小阈值

**技术细节**:
- 使用 `pako` 库进行 gzip 压缩（跨运行时兼容）
- 使用 `npm:brotli` 包进行 brotli 压缩（支持 Deno 和 Bun 运行时）
- 优先尝试使用运行时的 `CompressionStream` API（如果支持）
- 正确设置 Content-Encoding 响应头
- 验证压缩后数据大小小于原始数据

#### 2.3 CORS 中间件 (cors.test.ts) - 8 个测试

**测试场景**:
- ✅ 处理预检请求（OPTIONS）
- ✅ 设置 CORS 响应头
- ✅ 支持自定义源
- ✅ 支持自定义方法
- ✅ 支持自定义头部
- ✅ 支持凭证
- ✅ 支持最大年龄
- ✅ 支持通配符源

#### 2.4 CSRF 保护中间件 (csrf.test.ts) - 15 个测试

**测试场景**:
- ✅ 创建 CSRF 中间件
- ✅ 为 GET 请求生成 CSRF Token
- ✅ 跳过安全方法（GET、HEAD、OPTIONS）
- ✅ 验证 POST 请求的 Token
- ✅ 拒绝无效 Token
- ✅ 支持从请求头获取 Token
- ✅ 支持从表单字段获取 Token
- ✅ 支持从查询参数获取 Token
- ✅ 支持自定义 Token 生成函数
- ✅ 支持自定义 Cookie 选项
- ✅ 支持自定义 shouldSkip 函数
- ✅ 支持自定义 shouldVerify 函数
- ✅ 支持自定义错误消息
- ✅ 自动设置 Cookie
- ✅ 验证 Double Submit Cookie 模式

#### 2.5 错误处理中间件 (error-handler.test.ts) - 10 个测试

**测试场景**:
- ✅ 捕获和处理同步错误
- ✅ 捕获和处理异步错误
- ✅ 自定义错误响应
- ✅ 错误日志记录
- ✅ 错误状态码设置
- ✅ 支持 includeDetails 选项
- ✅ 开发模式详细错误信息
- ✅ 错误修复建议
- ✅ 开发模式 JSON 格式化
- ✅ 生产模式紧凑 JSON

#### 2.6 健康检查中间件 (health-check.test.ts) - 7 个测试

**测试场景**:
- ✅ 创建健康检查中间件
- ✅ 响应健康检查请求（返回 "OK"）
- ✅ 忽略非健康检查路径
- ✅ 支持自定义路径
- ✅ 支持自定义响应体（JSON 格式）
- ✅ 支持自定义状态码
- ✅ 支持自定义检查函数

#### 2.7 Metrics 中间件 (metrics.test.ts) - 18 个测试

**测试场景**:
- ✅ 创建 Metrics 中间件
- ✅ 收集请求统计信息
- ✅ 统计成功请求（2xx）
- ✅ 统计客户端错误（4xx）
- ✅ 统计服务器错误（5xx）
- ✅ 记录响应时间
- ✅ 按方法统计请求
- ✅ 按状态码统计请求
- ✅ 提供 /metrics 端点
- ✅ 返回 Prometheus 格式的指标
- ✅ 支持自定义指标端点路径
- ✅ 只处理 GET 请求到指标端点
- ✅ 支持禁用指标收集
- ✅ 支持包含分位数（P50、P95、P99）
- ✅ 支持限制响应时间样本数
- ✅ 统计信息重置
- ✅ 记录最小响应时间
- ✅ 记录最大响应时间

#### 2.8 性能分析中间件 (performance-analyzer.test.ts) - 13 个测试

**测试场景**:
- ✅ 创建性能分析中间件
- ✅ 记录请求的详细信息
- ✅ 记录中间件执行时间
- ✅ 检测慢请求并记录警告
- ✅ 检测慢中间件并记录警告
- ✅ 提供性能报告端点
- ✅ 生成 HTML 性能报告
- ✅ 支持自定义慢请求阈值
- ✅ 支持自定义慢中间件阈值
- ✅ 支持自定义最大记录数
- ✅ 支持自定义端点路径
- ✅ 支持禁用性能分析
- ✅ 支持清空性能数据

#### 2.9 请求限流中间件 (rate-limit.test.ts) - 12 个测试

**测试场景**:
- ✅ 创建限流中间件
- ✅ 允许在限制内的请求
- ✅ 限制超过限制的请求（返回 429 状态码）
- ✅ 支持自定义错误消息
- ✅ 支持自定义键生成函数（按用户限流）
- ✅ 返回限流响应头（X-RateLimit-Limit、X-RateLimit-Remaining、X-RateLimit-Reset）
- ✅ 支持时间窗口重置
- ✅ 支持跳过函数
- ✅ 支持自定义状态码
- ✅ 支持自定义响应格式
- ✅ 正确处理并发请求
- ✅ 资源清理（定时器）

#### 2.10 Request ID 中间件 (request-id.test.ts) - 11 个测试

**测试场景**:
- ✅ 创建 Request ID 中间件
- ✅ 为请求生成 Request ID
- ✅ 将 Request ID 添加到响应头
- ✅ 将 Request ID 存储到 context 中
- ✅ 使用请求头中的 Request ID（如果存在）
- ✅ 生成新的 Request ID（如果请求头中没有）
- ✅ 自定义请求头名称
- ✅ 禁用响应头中的 Request ID
- ✅ 自定义 ID 生成函数
- ✅ 禁用从请求头读取
- ✅ 为每个请求生成不同的 Request ID

#### 2.11 请求日志中间件 (request-logger.test.ts) - 5 个测试

**测试场景**:
- ✅ 记录请求信息
- ✅ 记录响应信息
- ✅ 支持自定义日志格式
- ✅ 支持日志级别
- ✅ 支持包含请求体

#### 2.12 请求签名验证中间件 (request-signature.test.ts) - 17 个测试

**测试场景**:
- ✅ 创建请求签名验证中间件
- ✅ 拒绝缺少签名的请求
- ✅ 拒绝缺少时间戳的请求
- ✅ 接受有效的签名
- ✅ 拒绝无效的签名
- ✅ 拒绝过期的签名
- ✅ 拒绝未来时间戳的请求
- ✅ 支持自定义签名算法（HS256、HS384、HS512）
- ✅ 支持自定义请求头名称
- ✅ 支持自定义签名过期时间
- ✅ 支持自定义时间戳容差
- ✅ 支持自定义 shouldSkip 函数
- ✅ 支持自定义错误消息
- ✅ 签名生成功能
- ✅ 为不同的请求生成不同的签名
- ✅ 包含查询参数在签名中
- ✅ 包含请求体在签名中

#### 2.13 请求验证中间件 (request-validator.test.ts) - 15 个测试

**测试场景**:
- ✅ 创建请求验证中间件
- ✅ 验证请求大小限制（body、header、URL）
- ✅ 验证查询参数数量
- ✅ 验证必需字段
- ✅ 验证字段类型
- ✅ 验证字段最小长度
- ✅ 验证字段最大长度
- ✅ 验证字段模式（正则表达式）
- ✅ 支持自定义验证函数（同步）
- ✅ 支持自定义验证函数（异步）
- ✅ 支持自定义错误格式化
- ✅ 支持 shouldSkip 配置
- ✅ 验证多个字段
- ✅ 处理验证错误
- ✅ 验证嵌套对象

#### 2.14 响应缓存中间件 (response-cache.test.ts) - 20 个测试

**测试场景**:
- ✅ 创建响应缓存中间件
- ✅ 缓存 GET 请求的响应
- ✅ 不缓存非 GET/HEAD 请求
- ✅ 支持 ETag 条件请求
- ✅ 支持 Last-Modified 条件请求
- ✅ 支持 If-None-Match 条件请求
- ✅ 支持 If-Modified-Since 条件请求
- ✅ 返回 304 Not Modified
- ✅ 设置 Cache-Control 响应头
- ✅ 支持自定义缓存键生成函数
- ✅ 支持自定义 shouldCache 函数
- ✅ 支持自定义 shouldSkip 函数
- ✅ 支持缓存大小限制
- ✅ 支持缓存 TTL
- ✅ 只缓存成功的响应（2xx）
- ✅ 不缓存错误响应
- ✅ 缓存统计信息
- ✅ 清空缓存
- ✅ 处理并发请求
- ✅ 缓存失效机制

#### 2.15 安全头中间件 (security-headers.test.ts) - 14 个测试

**测试场景**:
- ✅ 创建安全头中间件
- ✅ 设置默认安全头
- ✅ 支持 Cross-Origin-Embedder-Policy
- ✅ 支持 Cross-Origin-Opener-Policy
- ✅ 支持 Cross-Origin-Resource-Policy
- ✅ 支持 X-DNS-Prefetch-Control
- ✅ 支持 X-Download-Options
- ✅ 支持 X-Permitted-Cross-Domain-Policies
- ✅ 支持动态安全策略（同步）
- ✅ 支持动态安全策略（异步）
- ✅ 支持配置验证
- ✅ 支持禁用默认安全头
- ✅ 支持自定义安全头值
- ✅ 验证 COEP 和 COOP 的组合

#### 2.16 静态文件中间件 (static-files.test.ts) - 14 个测试

**测试场景**:
- ✅ 创建静态文件中间件
- ✅ 支持自定义根目录
- ✅ 支持自定义路径前缀
- ✅ 支持自定义索引文件
- ✅ 支持自定义缓存控制
- ✅ 支持 ETag
- ✅ 支持 Last-Modified
- ✅ 实际文件服务测试
- ✅ 支持启用内存缓存
- ✅ 支持禁用内存缓存
- ✅ 自定义缓存最大大小
- ✅ 自定义缓存 TTL
- ✅ 从缓存中获取文件
- ✅ 检测文件变化并更新缓存

#### 2.17 请求超时中间件 (timeout.test.ts) - 5 个测试

**测试场景**:
- ✅ 创建超时中间件
- ✅ 允许在超时内的请求
- ✅ 超时超过时间的请求（返回 408 状态码）
- ✅ 支持自定义错误消息
- ✅ 支持跳过函数

### 3. 开发工具模块

#### 3.1 HMR 客户端脚本生成 (dev/hmr-client.test.ts) - 8 个测试

**测试场景**:
- ✅ `injectHMRClient` 函数
  - 在 `</body>` 标签前注入脚本
  - 在 `</html>` 标签前注入脚本（如果没有 `</body>`）
  - 直接追加到末尾（如果既没有 `</body>` 也没有 `</html>`）
  - 正确包装脚本标签
- ✅ `generateHMRClientScript` 函数
  - 生成包含 WebSocket URL 的脚本
  - 支持自定义路径
  - 支持自定义端口和主机
  - 使用默认值

#### 3.2 路由推断 (dev/route-inference.test.ts) - 31 个测试

**测试场景**:
- ✅ 路由推断功能
  - 从 `pages` 目录推断路由
  - 从 `pages` 目录推断嵌套路由
  - 从 `pages` 目录推断深层嵌套路由
  - 从 `routes` 目录推断路由
  - 从 `app` 目录推断路由（App Router）
  - 处理动态路由参数 `[id]`
  - 处理捕获所有路由 `[...slug]`
  - 处理可选捕获路由 `[[...slug]]`
  - 处理可选参数 `[[id]]`
  - 移除 Next.js 路由组 (group)
  - 规范化路径（移除 index）
  - 规范化路径（移除尾随斜杠）
  - 处理 Windows 路径分隔符
  - 处理基础路径
  - 返回 undefined（如果无法推断）
- ✅ Layout 文件识别
  - 识别 `layout.tsx` 文件
  - 识别 `_layout.tsx` 文件
  - 识别 `app` 目录下的 layout 文件
  - 识别 `layout.ts` 文件
  - 识别 `layout.vue` 文件
  - 不应该识别普通页面文件
- ✅ 页面文件识别
  - 识别 `page.tsx` 文件（App Router）
  - 识别 `pages` 目录下的文件
  - 识别 `routes` 目录下的文件
  - 不应该识别 layout 文件
  - 不应该识别组件文件
- ✅ 组件文件识别
  - 识别 `components` 目录下的文件
  - 识别 `component` 目录下的文件
  - 不应该识别 layout 文件
  - 不应该识别页面文件
- ✅ 自定义路由模式支持

#### 3.3 模块依赖图 (dev/module-graph.test.ts) - 13 个测试

**测试场景**:
- ✅ 模块管理
  - 添加模块
  - 添加模块依赖关系
  - 处理多个依赖
  - 处理嵌套依赖
- ✅ 依赖追踪
  - 返回受影响的模块列表
  - 返回空数组（如果文件不存在）
  - 处理循环依赖
- ✅ 模块移除
  - 移除模块
  - 移除模块的依赖关系
- ✅ 模块查询
  - 根据文件路径获取模块 ID
  - 返回 undefined（如果文件不存在）
  - 根据模块 ID 获取文件路径
  - 返回 undefined（如果模块不存在）

#### 3.4 HMR 性能监控 (dev/performance-monitor.test.ts) - 13 个测试

**测试场景**:
- ✅ 更新记录
  - 开始记录更新
  - 记录更新开始时间
  - 记录文件路径
  - 记录更新类型
- ✅ 更新完成
  - 结束更新并记录耗时
  - 记录失败状态
- ✅ 统计信息
  - 返回初始统计信息
  - 统计成功的更新
  - 统计失败的更新
  - 计算平均耗时
- ✅ 性能指标
  - 返回最近的性能指标
  - 限制返回的记录数量
- ✅ 数据清理
  - 清除所有统计信息

## 📊 测试质量

### 测试完整性

✅ **功能测试**: 所有核心功能都有测试覆盖
✅ **边界情况**: 测试覆盖了边界情况和错误处理
✅ **资源管理**: 测试正确清理资源（定时器、文件句柄等）
✅ **集成测试**: 测试了模块之间的集成
✅ **跨运行时**: 所有测试在 Deno 和 Bun 运行时都通过

### 测试稳定性

✅ **无资源泄漏**: 所有测试都正确清理资源
✅ **无竞态条件**: 测试使用适当的同步机制
✅ **可重复性**: 所有测试都可以重复运行
✅ **隔离性**: 测试之间相互独立，不依赖执行顺序

### 测试工具

✅ **使用 @dreamer/test**: 统一使用项目测试库
✅ **测试辅助函数**: 使用 `createTestContext` 等辅助函数
✅ **测试钩子**: 正确使用 `beforeEach` 和 `afterEach` 清理资源

## 🔧 已知问题

无已知问题。所有测试都通过。

## 🐛 修复的问题

### 1. Cookie 管理修复
- ✅ 修复了 `parseCookie` 中值包含空格的处理
- ✅ 修复了 `serializeCookie` 中 `maxAge` 单位问题（支持毫秒和秒）
- ✅ 移除了默认的 `Path=/`，只有明确指定时才添加
- ✅ 修复了 `CookieManager.get()` 方法，现在会同时检查响应 Cookie 和请求 Cookie
- ✅ 修复了 `CookieManager.getAll()` 方法，现在会合并请求和响应 Cookie

### 2. Compression 中间件修复
- ✅ 修复了 brotli 压缩在 Bun 运行时的兼容性问题
  - 通过导入映射配置，Deno 和 Bun 都使用 `npm:brotli@1.3.3`
  - 统一使用 `import("brotli")`，由运行时根据导入映射解析
- ✅ 确保 brotli 优先级高于 gzip（如果客户端支持且启用）
- ✅ 改进了错误处理，提供更详细的错误信息
- ✅ 所有测试在 Deno 和 Bun 运行时都通过

### 3. Health Check 中间件修复
- ✅ 默认健康检查现在返回 "OK" 文本而不是 JSON
- ✅ 当有自定义检查函数且返回 `details` 时，返回 JSON 格式响应体

### 4. 资源泄漏修复
- ✅ `rate-limit` 中间件添加了 `cleanup()` 方法，测试中使用 `afterEach` 清理定时器
- ✅ `timeout` 中间件在 `finally` 块中清理 `setTimeout`，测试中使用 `afterEach` 清理测试定时器

### 5. 静态文件缓存修复
- ✅ 修复了文件变化检测问题（通过 mtime 比较）
- ✅ 修复了缓存失效机制
- ✅ 添加了延迟确保文件系统 mtime 更新

### 6. 类型错误修复
- ✅ 修复了测试中的 TypeScript 类型错误（`text` 可能为 `undefined`）

## 🌍 测试环境

- **运行时**:
  - Deno 2.6.4
  - Bun 1.3.5
- **测试框架**: @dreamer/test@^1.0.0-beta.12
- **操作系统**: macOS (darwin 24.6.0)
- **架构**: aarch64-apple-darwin

## 📝 结论

✅ **所有测试通过**: 325 个测试全部通过，通过率 100%

✅ **功能完整**: 所有核心功能都有完整的测试覆盖

✅ **质量保证**: 测试覆盖了正常流程、边界情况和错误处理

✅ **稳定性**: 测试正确管理资源，无资源泄漏

✅ **跨运行时**: 所有测试在 Deno 和 Bun 运行时都通过

**@dreamer/server 库已准备好用于生产环境。**

---

*最后更新：2026-01-11*
