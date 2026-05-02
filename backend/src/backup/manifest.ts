// Manifest-Erzeugung & -Validierung.
import { z } from "zod";
import type { BackupCategory, BackupManifest, BackupTrigger } from "./types.js";

export const ManifestSchema = z.object({
  appVersion: z.string().min(1),
  schemaVersion: z.number().int().min(0),
  createdAt: z.string().min(10),
  type: z.enum(["daily", "weekly", "monthly", "manual", "pre-restore", "pre-update"]),
  trigger: z.enum(["auto", "manual", "pre-restore", "pre-update"]),
  dbSha256: z.string().min(8),
  includedDirs: z.array(z.string()),
  sizes: z.object({ dbBytes: z.number().int(), uploadsBytes: z.number().int() }),
});

export function buildManifest(opts: {
  appVersion: string;
  schemaVersion: number;
  type: BackupCategory;
  trigger: BackupTrigger;
  dbSha256: string;
  dbBytes: number;
  uploadsBytes: number;
}): BackupManifest {
  return {
    appVersion: opts.appVersion,
    schemaVersion: opts.schemaVersion,
    createdAt: new Date().toISOString(),
    type: opts.type,
    trigger: opts.trigger,
    dbSha256: opts.dbSha256,
    includedDirs: ["db", "uploads", "keys"],
    sizes: { dbBytes: opts.dbBytes, uploadsBytes: opts.uploadsBytes },
  };
}

export function parseManifest(raw: unknown):
  | { ok: true; manifest: BackupManifest }
  | { ok: false; error: string } {
  const r = ManifestSchema.safeParse(raw);
  if (!r.success) return { ok: false, error: r.error.issues.map((i) => i.message).join("; ") };
  return { ok: true, manifest: r.data as BackupManifest };
}
