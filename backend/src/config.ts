import path from "node:path";

// Zentrale DB-Datei-Konstante. Backup, Restore und Live müssen denselben
// Namen verwenden, sonst landet ein Restore in einer toten Datei.
export const DB_FILENAME = "mycleancenter.db";

const DEFAULT_DATA_DIR =
  process.env.NODE_ENV === "production"
    ? "/var/lib/mycleancenter"
    : path.resolve(process.cwd(), "data");

export const config = {
  version: "0.2.0",
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "0.0.0.0",
  nodeEnv: process.env.NODE_ENV ?? "development",
  dataDir: process.env.DATA_DIR ?? DEFAULT_DATA_DIR,
  get dbPath() {
    return path.join(this.dataDir, "db", "mycleancenter.db");
  },
  get dbDir() {
    return path.join(this.dataDir, "db");
  },
  get keyPath() {
    return path.join(this.dataDir, "keys", "master.key");
  },
  get keysDir() {
    return path.join(this.dataDir, "keys");
  },
  get uploadsDir() {
    return path.join(this.dataDir, "uploads");
  },
  get backupsDir() {
    return path.join(this.dataDir, "backups");
  },
  get backupsDailyDir() {
    return path.join(this.backupsDir, "daily");
  },
  get backupsWeeklyDir() {
    return path.join(this.backupsDir, "weekly");
  },
  get backupsMonthlyDir() {
    return path.join(this.backupsDir, "monthly");
  },
  get backupsSafetyDir() {
    return path.join(this.backupsDir, "safety");
  },
  get backupsTmpDir() {
    return path.join(this.backupsDir, "tmp");
  },
  get logsDir() {
    return path.join(this.dataDir, "logs");
  },
  get maintenanceFlagPath() {
    return path.join(this.dataDir, "maintenance.flag");
  },
  // Frontend-Statics — vom Backend ausgeliefert (Pi: dist/ neben backend/).
  // Override via FRONTEND_DIR. Wenn Verzeichnis fehlt, wird Static-Plugin nicht geladen.
  frontendDir:
    process.env.FRONTEND_DIR ??
    (process.env.NODE_ENV === "production"
      ? "/opt/mycleancenter/current/dist"
      : path.resolve(process.cwd(), "..", "dist")),
  // CORS: LAN + Lovable Preview erlaubt. Im Dev sehr permissiv.
  corsOrigins: (process.env.CORS_ORIGINS ?? "*").split(",").map((s) => s.trim()),
} as const;

export type AppConfig = typeof config;
