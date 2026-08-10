import { ensureDir } from "fs-extra";
import { join } from "path";
import type { App } from "../common/app";

const QUICK_QUERIES_DIR_NAME = "quick-queries";

export async function getQuickQueriesDir(app: App): Promise<string> {
  const storagePath = app.workspaceStoragePath ?? app.globalStoragePath;
  const queriesPath = join(storagePath, QUICK_QUERIES_DIR_NAME);
  await ensureDir(queriesPath, { mode: 0o700 });
  return queriesPath;
}
