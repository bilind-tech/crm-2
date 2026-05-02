// System-Info-Endpoint (RAM/Disk/Versionen).
import os from "node:os";
import { statSync } from "node:fs";
import Database from "better-sqlite3";
import { config } from "../config.js";
import { listInstalledVersions } from "./repo.js";
import type { SystemInfoOut } from "./types.js";

export function getSystemInfo(): SystemInfoOut {
  const versions = listInstalledVersions();
  const aktiv = versions.find((v) => v.istAktiv);

  // SQLite-Version per Pragma
  let sqliteVersion = "?";
  try {
    const tmp = new Database(":memory:");
    sqliteVersion = (tmp.prepare("select sqlite_version() as v").get() as { v: string }).v;
    tmp.close();
  } catch { /* ignore */ }

  let hardware = `${os.arch()} · ${os.platform()} · ${os.release()}`;
  try {
    const totalGb = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
    const cpus = os.cpus()?.length ?? 0;
    hardware = `${cpus} CPUs · ${totalGb} GB RAM · ${os.platform()}/${os.arch()}`;
    // Disk-Free für DATA_DIR
    const _ = statSync(config.dataDir);
    void _;
  } catch { /* ignore */ }

  return {
    appName: "MyCleanCenter",
    version: config.version,
    installedAt: aktiv?.installedAt ?? new Date(0).toISOString(),
    node: process.version,
    sqlite: sqliteVersion,
    hardware,
  };
}
