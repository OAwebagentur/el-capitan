import nodemailer from "nodemailer";
import { appendToSentMailbox } from "./imap-sent";
import { meldeEreignis } from "../../../lib/oa-ereignis";

// nodemailer braucht die Node.js-Runtime (nicht Edge) und darf nicht
// statisch vorgerendert werden – jede Anfrage muss live verarbeitet werden.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mapping der Elementor-Feld-IDs (form_fields[...]) auf lesbare Labels,
// in der Reihenfolge, in der sie im Kontaktformular erscheinen.
//
// Gebucht wird seit dem 03.09.2026 ausschliesslich ueber dirs21; das Formular
// auf der Seite ist eine reine Kontaktanfrage. Die alten Buchungsfelder
// (Erwachsene, Kinder, An-/Abreise, Zimmerkategorie, Angebotscode) sind aus
// dem Formular entfernt. Ihre Labels bleiben hier stehen, damit eine Anfrage
// aus einem alten, noch offenen Browser-Tab weiterhin lesbar ankommt.
const FIELDS = [
  { key: "name", label: "Name" },
  { key: "email", label: "E-Mail" },
  { key: "field_1fd939e", label: "Telefon" },
  { key: "field_a040a6e", label: "Nachricht" },
  { key: "field_4c0584f", label: "Erwachsene" },
  { key: "field_8b18a8d", label: "Kinder (Anzahl)" },
  { key: "field_8297275", label: "Anreisedatum" },
  { key: "field_db8f6fa", label: "Abreisedatum" },
  { key: "field_c976bd5", label: "Zimmerkategorie" },
  { key: "field_9b92533", label: "Angebotscode" },
];

// Alle eingegebenen Felder unter lesbaren Namen — bekannte Elementor-IDs
// bekommen ihr Label, unbekannte behalten ihren Schluessel, damit ein
// spaeter im Formular ergaenztes Feld nicht stillschweigend verschwindet.
// Vollstaendig inklusive Name, E-Mail, Telefon und Wuenschen: Im Reporting
// soll die Anfrage selbst lesbar sein. So beauftragt.
function alleFelder(fields) {
  const labels = new Map(FIELDS.map((f) => [f.key, f.label]));
  const out = {};
  for (const [key, wert] of Object.entries(fields || {})) {
    const s = wert == null ? "" : String(wert).trim();
    if (s === "") continue;
    out[labels.get(key) || key] = s;
  }
  return out;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Akzeptiert sowohl JSON als auch klassisches Formular-POST und liefert
// immer ein flaches Objekt { fieldKey: value }. Zwei Werte gehoeren nicht
// zu den Formularfeldern und werden herausgetrennt: `oa_kontext` (Herkunft
// der Sitzung) und `webseite` (Honeypot fuer das OA-Reporting).
async function readFields(request) {
  const contentType = request.headers.get("content-type") || "";
  const raw = {};
  let kontext = {};
  let honeypot = "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    if (body && typeof body === "object") {
      if (body.oa_kontext) kontext = body.oa_kontext;
      if (typeof body.webseite === "string") honeypot = body.webseite;
    }
    const src = body && typeof body === "object" ? body.form_fields || body : {};
    for (const [k, v] of Object.entries(src)) {
      if (k === "oa_kontext" || k === "webseite") continue;
      const m = k.match(/^form_fields\[(.+)\]$/);
      raw[m ? m[1] : k] = Array.isArray(v) ? v.join(", ") : v;
    }
  } else {
    const form = await request.formData();
    for (const [k, v] of form.entries()) {
      if (k === "oa_kontext") {
        try {
          kontext = JSON.parse(String(v));
        } catch {
          /* ohne Kontext weiter — der Versand haengt nie daran */
        }
        continue;
      }
      if (k === "webseite") {
        honeypot = String(v);
        continue;
      }
      const m = k.match(/^form_fields\[(.+)\]$/);
      raw[m ? m[1] : k] = v;
    }
  }
  return {
    raw,
    kontext: kontext && typeof kontext === "object" ? kontext : {},
    honeypot,
  };
}

let cachedTransporter = null;
function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;
  const user = process.env.SMTP_USER;
  // Google App-Passwoerter werden in 4er-Gruppen mit Leerzeichen angezeigt;
  // fuer die Authentifizierung muessen die Leerzeichen entfernt werden.
  const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");

  if (!user || !pass) {
    throw new Error("SMTP_USER / SMTP_PASS sind nicht konfiguriert.");
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return cachedTransporter;
}

// Baut die fertige RFC822-Nachricht, ohne sie zu versenden. Damit koennen
// SMTP-Versand und IMAP-Ablage im Gesendet-Ordner exakt dieselbe Mail nutzen.
let cachedBuilder = null;
function getBuilder() {
  if (!cachedBuilder) {
    cachedBuilder = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
    });
  }
  return cachedBuilder;
}

export async function POST(request) {
  let fields;
  let oaKontext = {};
  let honeypot = "";
  try {
    const gelesen = await readFields(request);
    fields = gelesen.raw;
    oaKontext = gelesen.kontext;
    honeypot = gelesen.honeypot;
  } catch {
    return Response.json(
      { success: false, error: "Ungültige Anfrage." },
      { status: 400 }
    );
  }

  const name = (fields.name || "").toString().trim();
  const email = (fields.email || "").toString().trim();

  // Minimale serverseitige Validierung der Pflichtangaben.
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(
      { success: false, error: "Bitte Name und eine gültige E-Mail-Adresse angeben." },
      { status: 400 }
    );
  }

  // Nur befüllte, bekannte Felder in die Mail übernehmen.
  const rows = FIELDS.filter(
    (f) => fields[f.key] != null && String(fields[f.key]).trim() !== ""
  ).map((f) => ({ label: f.label, value: String(fields[f.key]).trim() }));

  const textBody = rows.map((r) => `${r.label}: ${r.value}`).join("\n");
  const htmlRows = rows
    .map(
      (r) =>
        `<tr><td style="padding:6px 12px;border:1px solid #e0e0e0;background:#faf7f2;font-weight:600;white-space:nowrap;">${escapeHtml(
          r.label
        )}</td><td style="padding:6px 12px;border:1px solid #e0e0e0;">${escapeHtml(
          r.value
        ).replace(/\n/g, "<br>")}</td></tr>`
    )
    .join("");

  const htmlBody = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:640px;">
    <h2 style="color:#8a6d3b;margin:0 0 4px;">Neue Kontaktanfrage – El Capitan</h2>
    <p style="margin:0 0 16px;color:#666;">Über das Kontaktformular auf el-capitan.net eingegangen. Buchungen laufen über dirs21.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">${htmlRows}</table>
  </div>`;

  const mailFrom = process.env.MAIL_FROM || process.env.SMTP_USER;
  const mailTo = process.env.MAIL_TO || process.env.SMTP_USER;
  // Optionale BCC-Adresse(n), kommagetrennt. Aktuell zum Mitlesen/Testen.
  const mailBcc = (process.env.MAIL_BCC || "").trim();

  const bccList = mailBcc
    ? mailBcc
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
    : [];

  // Die Nachricht wird OHNE Bcc-Header gebaut: beim Versand als Rohtext wuerde
  // nodemailer den Header nicht entfernen, und der Empfaenger saehe die
  // Mitleser-Adresse. Die BCC-Zustellung laeuft stattdessen ueber den Envelope.
  const message = {
    from: `"El Capitan Kontakt" <${mailFrom}>`,
    to: mailTo,
    replyTo: `"${name}" <${email}>`,
    subject: `Kontaktanfrage von ${name}`,
    text: textBody,
    html: htmlBody,
  };

  let sentCopyRaw = null;
  try {
    const transporter = getTransporter();

    // Einmal bauen, dann als Rohtext versenden – so ist die Kopie im
    // Gesendet-Ordner dieselbe Mail (gleiche Message-ID) wie beim Empfaenger.
    const built = await getBuilder().sendMail(message);
    const envelope = {
      from: built.envelope.from,
      to: [...built.envelope.to, ...bccList],
    };
    await transporter.sendMail({ raw: built.message, envelope });

    // Fuer die Ablage im Gesendet-Ordner den Bcc-Header ergaenzen, damit im
    // Postfach nachvollziehbar bleibt, wer die Kopie bekommen hat.
    sentCopyRaw = bccList.length
      ? Buffer.concat([
          Buffer.from(`Bcc: ${bccList.join(", ")}\r\n`),
          built.message,
        ])
      : built.message;
  } catch (err) {
    console.error("Kontakt-Mail konnte nicht gesendet werden:", err);
    return Response.json(
      {
        success: false,
        error:
          "Die Anfrage konnte nicht versendet werden. Bitte versuchen Sie es später erneut.",
      },
      { status: 502 }
    );
  }

  // Kopie in den Gesendet-Ordner legen. Rein informativ: die Anfrage ist
  // versendet, ein Fehler hier darf die Antwort nicht rot machen.
  const sentCopy = await appendToSentMailbox(sentCopyRaw);
  if (!sentCopy.ok) {
    console.warn(
      "Kopie im Gesendet-Ordner konnte nicht abgelegt werden:",
      sentCopy.reason
    );
  }

  // Besucherdaten der URSPRUENGLICHEN Anfrage — ohne sie sieht der
  // OA-Endpoint nur diesen Vercel-Server statt des Besuchers (IP US,
  // website null, Herkunft immer "direkt"). Lieber null als falsch: fehlt
  // ein Header, bleibt das Feld einfach weg.
  const weitergeleitetVon = request.headers.get("x-forwarded-for");

  // Anfrage ans OA-Reporting melden — ERST hier, wenn die Mail beim Hotel
  // ist. Scheitert das Reporting, bleibt die Anfrage trotzdem erfolgreich:
  // `meldeEreignis` wirft nicht, und der Mailversand hat immer Vorrang.
  await meldeEreignis("formular", {
    ...oaKontext,
    // Fallback ohne oa-tracking.js: derselbe Wert, den das Tracking meldet
    // (location.pathname), damit die Anfrage im Reporting bei "/" landet.
    seite: oaKontext.seite || "/",
    felder: alleFelder(fields),
    webseite: honeypot,
    website: request.headers.get("host"),
    besucherIp: weitergeleitetVon
      ? weitergeleitetVon.split(",")[0].trim()
      : undefined,
    besucherUserAgent: request.headers.get("user-agent"),
    besucherLand: request.headers.get("x-vercel-ip-country"),
    besucherStadt: request.headers.get("x-vercel-ip-city"),
  });

  return Response.json({ success: true });
}

// GET liefert eine kleine Diagnose, ohne Secrets preiszugeben.
export async function GET() {
  return Response.json({
    ok: true,
    configured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  });
}
