import nodemailer from "nodemailer";

// nodemailer braucht die Node.js-Runtime (nicht Edge) und darf nicht
// statisch vorgerendert werden – jede Anfrage muss live verarbeitet werden.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mapping der Elementor-Feld-IDs (form_fields[...]) auf lesbare Labels,
// in der Reihenfolge, in der sie im Buchungsformular erscheinen.
const FIELDS = [
  { key: "name", label: "Name" },
  { key: "email", label: "E-Mail" },
  { key: "field_1fd939e", label: "Telefon" },
  { key: "field_4c0584f", label: "Erwachsene" },
  { key: "field_8b18a8d", label: "Kinder (Anzahl)" },
  { key: "field_8297275", label: "Anreisedatum" },
  { key: "field_db8f6fa", label: "Abreisedatum" },
  { key: "field_c976bd5", label: "Zimmerkategorie" },
  { key: "field_9b92533", label: "Angebotscode" },
  { key: "field_a040a6e", label: "Spezielle Wünsche" },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Akzeptiert sowohl JSON als auch klassisches Formular-POST und liefert
// immer ein flaches Objekt { fieldKey: value }.
async function readFields(request) {
  const contentType = request.headers.get("content-type") || "";
  const raw = {};

  if (contentType.includes("application/json")) {
    const body = await request.json();
    const src = body && typeof body === "object" ? body.form_fields || body : {};
    for (const [k, v] of Object.entries(src)) {
      const m = k.match(/^form_fields\[(.+)\]$/);
      raw[m ? m[1] : k] = Array.isArray(v) ? v.join(", ") : v;
    }
  } else {
    const form = await request.formData();
    for (const [k, v] of form.entries()) {
      const m = k.match(/^form_fields\[(.+)\]$/);
      raw[m ? m[1] : k] = v;
    }
  }
  return raw;
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

export async function POST(request) {
  let fields;
  try {
    fields = await readFields(request);
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
    <h2 style="color:#8a6d3b;margin:0 0 4px;">Neue Buchungsanfrage – El Capitan</h2>
    <p style="margin:0 0 16px;color:#666;">Über das Buchungsformular auf el-capitan.net eingegangen.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">${htmlRows}</table>
  </div>`;

  const mailFrom = process.env.MAIL_FROM || process.env.SMTP_USER;
  const mailTo = process.env.MAIL_TO || process.env.SMTP_USER;
  // Optionale BCC-Adresse(n), kommagetrennt. Aktuell zum Mitlesen/Testen.
  const mailBcc = (process.env.MAIL_BCC || "").trim();

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"El Capitan Buchung" <${mailFrom}>`,
      to: mailTo,
      ...(mailBcc ? { bcc: mailBcc } : {}),
      replyTo: `"${name}" <${email}>`,
      subject: `Buchungsanfrage von ${name}`,
      text: textBody,
      html: htmlBody,
    });
  } catch (err) {
    console.error("Buchungs-Mail konnte nicht gesendet werden:", err);
    return Response.json(
      {
        success: false,
        error:
          "Die Anfrage konnte nicht versendet werden. Bitte versuchen Sie es später erneut.",
      },
      { status: 502 }
    );
  }

  return Response.json({ success: true });
}

// GET liefert eine kleine Diagnose, ohne Secrets preiszugeben.
export async function GET() {
  return Response.json({
    ok: true,
    configured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  });
}
