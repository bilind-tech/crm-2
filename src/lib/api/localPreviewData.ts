import type {
  Angebot,
  DashboardKennzahlen,
  Firmendaten,
  Kunde,
  Rechnung,
  UmsatzPunkt,
} from "@/lib/api/types";

const now = new Date();
const isoNow = now.toISOString();
const today = isoNow.slice(0, 10);
const due = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);
const month = today.slice(0, 7);

const optionen = {
  materialBereitgestellt: true,
  standardAnschreiben: true,
  wiederkehrend: false,
};

export const previewFirma: Firmendaten = {
  firmenname: "My Clean Center",
  rechtsform: "GmbH",
  strasse: "Musterstraße 12",
  plz: "53757",
  ort: "Sankt Augustin",
  land: "Deutschland",
  telefon: "+49 2241 000000",
  email: "info@mycleancenter.cm",
  webseite: "mycleancenter.cm",
  ustId: "DE000000000",
  handelsregister: "HRB 00000",
  geschaeftsfuehrer: "Geschäftsführung",
  bankName: "Musterbank",
  iban: "DE00 0000 0000 0000 0000 00",
  bic: "MUSTERXXX",
  standardSteuersatz: 19,
  standardZahlungszielTage: 14,
};

export const previewKunden: Kunde[] = [
  {
    id: "preview-kunde-1",
    nummer: "K-0001",
    kuerzel: "GFU",
    typ: "firma",
    firmenname: "Gebäudereinigung Futura GmbH",
    strasse: "Beispielweg 5",
    plz: "53757",
    ort: "Sankt Augustin",
    land: "Deutschland",
    email: "kontakt@futura.test",
    telefon: "+49 2241 123456",
    zahlungszielTage: 14,
    standardSteuersatz: 19,
    standardRabatt: 0,
    tags: ["Preview"],
    status: "aktiv",
    archiviert: false,
    erstelltAm: isoNow,
    geaendertAm: isoNow,
  },
];

export const previewAngebote: Angebot[] = [
  {
    id: "preview-angebot-1",
    nummer: "GFU0526/01",
    kundeId: "preview-kunde-1",
    titel: "Unterhaltsreinigung Büroflächen",
    positionen: [
      {
        id: "pos-a-1",
        beschreibung: "Regelmäßige Unterhaltsreinigung\n- Arbeitsplätze\n- Sanitärbereiche\n- Küchenbereich",
        menge: 1,
        einheit: "pauschal",
        einzelpreisNetto: 0,
        steuersatz: 19,
        rabatt: 0,
        modus: "pauschal",
        pauschalpreisNetto: 850,
        ausfuehrung: "Mo–Fr · monatlich",
      },
    ],
    rabattGesamt: 0,
    steuersatz: 19,
    gueltigBis: due,
    status: "versendet",
    archiviert: false,
    optionen,
    erstelltAm: isoNow,
    geaendertAm: isoNow,
  },
];

export const previewRechnungen: Rechnung[] = [
  {
    id: "preview-rechnung-1",
    nummer: "GFU0526/02",
    kundeId: "preview-kunde-1",
    titel: "Unterhaltsreinigung Mai",
    positionen: [
      {
        id: "pos-r-1",
        beschreibung: "Unterhaltsreinigung Büroflächen",
        menge: 1,
        einheit: "pauschal",
        einzelpreisNetto: 0,
        steuersatz: 19,
        rabatt: 0,
        modus: "pauschal",
        pauschalpreisNetto: 850,
        ausfuehrung: "Mai",
      },
    ],
    rabattGesamt: 0,
    steuersatz: 19,
    rechnungsdatum: today,
    faelligkeitsdatum: due,
    status: "versendet",
    archiviert: false,
    zahlungen: [],
    optionen,
    erstelltAm: isoNow,
    geaendertAm: isoNow,
  },
];

export function previewDashboardKennzahlen(): DashboardKennzahlen {
  return {
    aktiveKunden: previewKunden.length,
    aktiveObjekte: 0,
    offeneAngebote: previewAngebote.filter((a) => a.status === "entwurf" || a.status === "versendet").length,
    offeneRechnungen: previewRechnungen.filter((r) => r.status !== "bezahlt" && r.status !== "storniert").length,
    umsatzMonat: 1011.5,
    ueberfaellig: 0,
  } as DashboardKennzahlen;
}

export function previewUmsatz(): UmsatzPunkt[] {
  return [{ monat: month, netto: 850, steuer: 161.5, brutto: 1011.5 } as UmsatzPunkt];
}

export function localPreviewGet<T>(path: string): T | null {
  const [cleanPath, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  if (cleanPath === "/auth/me") {
    return { user: { id: "preview-user", username: "lokal" }, expiresAt: new Date(Date.now() + 86400000).toISOString() } as T;
  }
  if (cleanPath === "/kunden") return previewKunden as T;
  if (cleanPath.startsWith("/kunden/")) {
    const id = cleanPath.split("/")[2];
    const kunde = previewKunden.find((k) => k.id === id);
    if (!kunde) return null;
    return {
      ...kunde,
      ansprechpartner: [],
      objekte: [],
      angebote: previewAngebote.filter((a) => a.kundeId === id),
      rechnungen: previewRechnungen.filter((r) => r.kundeId === id),
      dokumente: [],
      notizen: [],
    } as T;
  }
  if (cleanPath === "/angebote") {
    const kundeId = params.get("kundeId");
    const status = params.get("status");
    return previewAngebote.filter((a) => (!kundeId || a.kundeId === kundeId) && (!status || a.status === status)) as T;
  }
  if (cleanPath.startsWith("/angebote/")) {
    return (previewAngebote.find((a) => a.id === cleanPath.split("/")[2]) ?? null) as T | null;
  }
  if (cleanPath === "/rechnungen") {
    const kundeId = params.get("kundeId");
    const status = params.get("status");
    return previewRechnungen.filter((r) => (!kundeId || r.kundeId === kundeId) && (!status || r.status === status)) as T;
  }
  if (cleanPath.startsWith("/rechnungen/")) {
    return (previewRechnungen.find((r) => r.id === cleanPath.split("/")[2]) ?? null) as T | null;
  }
  if (cleanPath === "/objekte") return [] as T;
  if (cleanPath === "/dokumente") return [] as T;
  if (cleanPath === "/protokolle") return [] as T;
  if (cleanPath === "/dashboard/kennzahlen") return previewDashboardKennzahlen() as T;
  if (cleanPath === "/dashboard/umsatz") return previewUmsatz() as T;
  if (cleanPath === "/dashboard/warnungen") return [] as T;
  if (cleanPath === "/aktivitaeten") return [] as T;
  if (cleanPath === "/benachrichtigungen") return [] as T;
  if (cleanPath === "/einstellungen/firma") return previewFirma as T;
  if (cleanPath === "/mahnung/status") return { einstellungen: { autoVorschlagAktiv: false, modus: "vorschlag", cronZeit: "09:00", nurAnWerktagen: true, benachrichtigungBeiVorschlag: true, benachrichtigungBeiAutoversand: false, stufen: [] }, letzterLauf: null } as T;
  if (cleanPath === "/mahnung/laeufe") return [] as T;
  if (cleanPath === "/dauerauftrag-laeufe") return [] as T;
  return null;
}
