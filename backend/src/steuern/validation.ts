import { z } from "zod";

export const EinstellungenPatchSchema = z
  .object({
    kstSatz: z.number().min(0).max(50),
    soliSatz: z.number().min(0).max(20),
    gewstMesszahl: z.number().min(0).max(20),
    gewstHebesatz: z.number().min(200).max(1000),
    ustRhythmus: z.enum(["monatlich", "quartalsweise", "jaehrlich"]),
    ruecklageSatz: z.number().min(0).max(100),
    ustPufferSatz: z.number().min(0).max(50),
  })
  .partial();

export type EinstellungenPatch = z.infer<typeof EinstellungenPatchSchema>;

const ZeitraumSchema = z.object({
  jahr: z.number().int().min(2000).max(2100),
  monat: z.number().int().min(1).max(12).nullable().optional(),
  quartal: z.number().int().min(1).max(4).nullable().optional(),
});

export const ManuellerInputSchema = z.object({
  art: z.enum(["ust", "kst", "soli", "gewst", "manuell"]),
  titel: z.string().min(1).max(200),
  zeitraum: ZeitraumSchema,
  faelligAm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein"),
  geschaetzterBetrag: z.number().min(0).max(1_000_000_000),
  notiz: z.string().max(2000).nullable().optional(),
});

export const ManuellerPatchSchema = ManuellerInputSchema.partial();

export const BezahltInputSchema = z.object({
  bezahltAm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein"),
  tatsaechlicherBetrag: z.number().min(0).max(1_000_000_000).nullable().optional(),
  notiz: z.string().max(2000).nullable().optional(),
});
