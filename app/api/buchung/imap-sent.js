import { ImapFlow } from "imapflow";

// Namen, unter denen der "Gesendet"-Ordner bei den ueblichen Hostern liegt.
// Wird nur benutzt, wenn der Server kein SPECIAL-USE-Flag (\Sent) liefert.
const SENT_FALLBACKS = [
  "Sent",
  "INBOX.Sent",
  "Gesendet",
  "INBOX.Gesendet",
  "Gesendete Objekte",
  "INBOX.Gesendete Objekte",
  "Sent Items",
  "INBOX.Sent Items",
  "Sent Messages",
  "INBOX.Sent Messages",
];

function imapConfig() {
  // IMAP-Zugang faellt auf die SMTP-Zugangsdaten zurueck – beim gleichen
  // Hoster ist es dasselbe Postfach, nur anderer Port.
  const host = process.env.IMAP_HOST || process.env.SMTP_HOST;
  const user = process.env.IMAP_USER || process.env.SMTP_USER;
  const pass = (process.env.IMAP_PASS || process.env.SMTP_PASS || "").replace(
    /\s+/g,
    ""
  );
  if (!host || !user || !pass) return null;

  const port = Number(process.env.IMAP_PORT || 993);
  const secure = process.env.IMAP_SECURE
    ? process.env.IMAP_SECURE === "true"
    : port === 993;

  return { host, port, secure, auth: { user, pass }, logger: false };
}

// Sucht den Gesendet-Ordner: erst per SPECIAL-USE, dann per Namensliste.
async function resolveSentMailbox(client) {
  const configured = (process.env.IMAP_SENT_MAILBOX || "").trim();
  if (configured) return configured;

  const boxes = await client.list();
  const bySpecialUse = boxes.find((b) => b.specialUse === "\\Sent");
  if (bySpecialUse) return bySpecialUse.path;

  const paths = new Set(boxes.map((b) => b.path));
  const byName = SENT_FALLBACKS.find((name) => paths.has(name));
  if (byName) return byName;

  const loose = boxes.find((b) => /sent|gesendet/i.test(b.path));
  return loose ? loose.path : null;
}

/**
 * Legt eine bereits versendete Mail per IMAP APPEND im Gesendet-Ordner ab,
 * damit sie im Postfach (Webmail/Outlook) auftaucht.
 *
 * Wirft nie – der Versand ist zu diesem Zeitpunkt schon erfolgt, ein
 * fehlgeschlagener APPEND darf die Buchungsanfrage nicht scheitern lassen.
 *
 * @param {Buffer|string} raw komplette RFC822-Nachricht
 * @returns {Promise<{ok: boolean, mailbox?: string, reason?: string}>}
 */
export async function appendToSentMailbox(raw) {
  if (process.env.IMAP_APPEND_SENT === "false") {
    return { ok: false, reason: "deaktiviert (IMAP_APPEND_SENT=false)" };
  }

  const config = imapConfig();
  if (!config) return { ok: false, reason: "IMAP nicht konfiguriert" };

  let client;
  try {
    client = new ImapFlow(config);
    await client.connect();

    const mailbox = await resolveSentMailbox(client);
    if (!mailbox) {
      return { ok: false, reason: "Gesendet-Ordner nicht gefunden" };
    }

    await client.append(mailbox, raw, ["\\Seen"]);
    return { ok: true, mailbox };
  } catch (err) {
    return { ok: false, reason: err?.message || String(err) };
  } finally {
    try {
      await client?.logout();
    } catch {
      client?.close?.();
    }
  }
}
