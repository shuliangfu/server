/**
 * 端口检测工具
 *
 * 用于检测端口是否被占用，并在端口被占用时顺次尝试 port+1 直到找到可用端口
 */

import { connect } from "@dreamer/runtime-adapter";
import { $t, type Locale } from "./i18n.ts";

/**
 * 检测指定 host:port 是否已被占用（是否有进程在监听）
 *
 * 通过尝试建立 TCP 连接判断：连接成功表示端口被占用，连接被拒绝表示端口可用
 *
 * @param host 主机名（如 "localhost"、"127.0.0.1"）
 * @param port 端口号
 * @returns 若端口已被占用返回 true，否则返回 false
 */
export async function isPortInUse(
  host: string,
  port: number,
): Promise<boolean> {
  try {
    const conn = await connect({ host, port });
    conn.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * 从起始端口开始顺次 +1 查找可用端口
 *
 * 若 startPort 可用则直接返回；若被占用则尝试 startPort+1、startPort+2，直到找到可用端口或达到最大尝试次数
 *
 * @param host 主机名
 * @param startPort 起始端口号
 * @param maxAttempts 最大尝试次数（默认 100，即最多尝试 100 个连续端口）
 * @param lang 服务端文案语言（可选）；不传则从环境变量自动检测
 * @returns 第一个可用端口号
 * @throws 若在 maxAttempts 次内未找到可用端口则抛出错误
 */
export async function findAvailablePort(
  host: string,
  startPort: number,
  maxAttempts: number = 100,
  lang?: Locale,
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const inUse = await isPortInUse(host, port);
    if (!inUse) {
      return port;
    }
  }
  throw new Error(
    $t("error.noAvailablePort", {
      startPort: String(startPort),
      maxAttempts: String(maxAttempts),
    }, lang),
  );
}
