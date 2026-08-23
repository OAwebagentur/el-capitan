/*
 * OA-Kontaktereignisse — serverseitige Meldung.
 *
 * Gegenstueck zu public/oa-tracking.js: Die vier Klick-Arten meldet der
 * Browser selbst (nur so kommen Besucher-IP und User-Agent richtig beim
 * Endpoint an), die Formular-Anfrage meldet der Server hier — sie liegt
 * ohnehin erst in /api/buchung/ vollstaendig vor.
 *
 * Verbindliche Vorlage: docs/formular-integration.md im Repo kundenportal.
 * Kein Token, kein Key — der Schutz sitzt serverseitig beim Endpoint
 * (Positivliste, Ratenbegrenzung, Honeypot, Groessengrenzen).
 *
 * Diese Datei wirft nie. Das Reporting ist Beiwerk: Ein Ausfall dort darf
 * die Buchungsanfrage niemals scheitern lassen.
 */

/** Fester Wert je Kundenseite — siehe Tabelle in docs/formular-integration.md. */
export const KUNDE_ID = "el-capitan";

export const ENDPOINT =
  process.env.NEXT_PUBLIC_OA_EREIGNIS_ENDPOINT ||
  "https://kunden.oawebagentur.de/api/ereignis";

/** Grenzen des Endpoints, hier eingehalten statt dort abgewiesen zu werden. */
const MAX_FELDER = 40;
const MAX_SCHLUESSEL = 200;
const MAX_WERT = 8000;

/** Wie lange auf das Portal gewartet wird, bevor abgebrochen wird (ms). */
const TIMEOUT_MS = 4000;

const OPTIONAL = [
  "seite",
  "seiteTitel",
  "landeseite",
  "referrer",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "wbraid",
  "gbraid",
  "sprache",
  "bildschirm",
  "zeitzone",
  "sitzungId",
  // Nur bei serverseitiger Meldung gesetzt (siehe app/api/buchung/route.js,
  // Abschnitt 6 "Verwendung 3" in docs/formular-integration.md): Der
  // Besucher der URSPRUENGLICHEN Anfrage, nicht dieser Server.
  "website",
  "besucherIp",
  "besucherUserAgent",
  "besucherLand",
  "besucherStadt",
];

function text(wert) {
  if (wert == null) return undefined;
  const s = String(wert).trim();
  return s === "" ? undefined : s;
}

/**
 * Formularfelder in die Form bringen, die der Endpoint annimmt: 1–40
 * Eintraege, Schluessel <= 200, Werte <= 8000 Zeichen.
 *
 * Es gehen ALLE Felder mit, Name, E-Mail, Telefon und Wuensche
 * eingeschlossen — so ist es fuer dieses Projekt ausdruecklich vorgegeben.
 */
export function begrenzeFelder(felder) {
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(felder || {})) {
    if (n >= MAX_FELDER) break;
    const wert = v == null ? "" : String(v).trim();
    if (wert === "") continue;
    out[String(k).slice(0, MAX_SCHLUESSEL)] = wert.slice(0, MAX_WERT);
    n++;
  }
  return out;
}

/**
 * Ereignis melden. Gibt `true` zurueck, wenn der Endpoint es angenommen hat.
 * Wirft nie — Fehler landen nur im Serverlog.
 *
 * `zeitpunkt`, User-Agent, IP, Geraet, Browser und Herkunftsklasse gehen
 * bewusst NICHT mit: die setzt bzw. leitet der Endpoint selbst ab.
 */
export async function meldeEreignis(art, extra = {}) {
  const controller = new AbortController();
  const abbruch = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body = {
      kundeId: KUNDE_ID,
      art,
      // Honeypot: immer mitschicken, immer leer. Kommt aus dem Formular
      // ein befuellter Wert, geht genau der raus — dann verwirft der
      // Endpoint die Anfrage still.
      webseite: typeof extra.webseite === "string" ? extra.webseite : "",
    };

    if (extra.zielwert) body.zielwert = String(extra.zielwert);
    if (extra.felder) {
      const felder = begrenzeFelder(extra.felder);
      if (Object.keys(felder).length) body.felder = felder;
    }
    for (const schluessel of OPTIONAL) {
      const wert = text(extra[schluessel]);
      if (wert !== undefined) body[schluessel] = wert;
    }

    const antwort = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!antwort.ok) {
      console.warn(
        `OA-Ereignis (${art}): Endpoint antwortete mit ${antwort.status}.`
      );
    }
    return antwort.ok;
  } catch (err) {
    console.warn(`OA-Ereignis (${art}) konnte nicht gemeldet werden:`, err && err.message);
    return false;
  } finally {
    clearTimeout(abbruch);
  }
}
