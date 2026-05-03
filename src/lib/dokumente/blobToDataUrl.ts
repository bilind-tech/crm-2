// Wandelt einen Blob (z. B. PDF) in eine data:-URL für die Dokumente-Datenbank.
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error("FileReader-Fehler"));
    r.readAsDataURL(blob);
  });
}
