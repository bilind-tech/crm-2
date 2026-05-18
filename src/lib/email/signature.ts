// Wandelt nackte Bild-URLs in einer Signatur (oder einem Mail-Body) in
// <img>-Tags um, damit sie im Browser und im Mailclient sichtbar sind.
// Wirkt nur lesend — der DB-Wert bleibt unverändert.

const URL_RE =
  /(?<!["'=>])\bhttps?:\/\/[^\s<>"']+?\.(?:png|jpe?g|gif|webp|svg)(?:\?[^\s<>"']*)?/gi;

export function autoLinkifyImages(html: string): string {
  if (!html) return html;
  return html.replace(URL_RE, (url) => {
    return `<img src="${url}" alt="" style="max-width:240px;height:auto;display:inline-block;border:0;" />`;
  });
}
