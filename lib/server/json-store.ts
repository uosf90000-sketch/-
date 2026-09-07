import { readFile, writeFile, rename, open, stat, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
export async function readJson(file: string, fallback: any = null) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error: any) { if (error.code === "ENOENT") return fallback; throw error; }
}
export async function writeJson(file: string, value: unknown) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), "utf8");
  await rename(temporary, file);
}
export async function withFileLock<T>(file: string, operation: () => Promise<T>): Promise<T> {
  const lockFile = file + ".lock";
  try { const info = await stat(lockFile); if (Date.now() - info.mtimeMs > 180000) await unlink(lockFile); } catch (e: any) { if (e.code !== "ENOENT") throw e; }
  let handle;
  try { handle = await open(lockFile, "wx"); }
  catch (e: any) { if (e.code === "EEXIST") throw new Error("الطلب السابق ما زال جاريًا. انتظر قليلًا ثم استكمل."); throw e; }
  try { return await operation(); }
  finally { await handle.close(); await unlink(lockFile).catch(() => {}); }
}
