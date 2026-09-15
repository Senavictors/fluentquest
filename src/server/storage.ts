import { mkdir, writeFile, readFile, unlink, readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "../domain/content";
const root = path.resolve(process.env.DATA_DIR || "./data", "objects");
export interface ObjectStorage {
  put(userId: string, bytes: Uint8Array): Promise<string>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
function safePath(key: string) {
  if (!/^[a-zA-Z0-9_-]+\/[a-f0-9-]+$/.test(key))
    throw new AppError("INVALID_OBJECT", "Arquivo inválido.", 404);
  const result = path.resolve(root, key);
  if (!result.startsWith(root + path.sep))
    throw new AppError("INVALID_OBJECT", "Arquivo inválido.", 404);
  return result;
}
export const storage: ObjectStorage = {
  async put(userId, bytes) {
    const key = `${userId}/${randomUUID()}`;
    const filename = safePath(key);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, bytes, { flag: "wx" });
    return key;
  },
  async get(key) {
    return readFile(safePath(key));
  },
  async remove(key) {
    try {
      await unlink(safePath(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  },
};
export async function removeUserObjects(userId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) throw new Error("Invalid owner");
  const dir = path.join(root, userId);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
    throw e;
  }
  for (const file of files) await storage.remove(`${userId}/${file}`);
}
