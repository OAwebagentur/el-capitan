/*
 * OA-Kontaktereignisse — Browserseite.
 *
 * Umsetzung von docs/formular-integration.md (Repo kundenportal) fuer
 * el-capitan. Die Seite ist ein 1:1-Spiegel einer WordPress/Elementor-Seite:
 * Die Inhalte liegen als rohes HTML in content/pages.json, Telefon- und
 * E-Mail-Adressen stehen mitten darin. Deshalb wird hier NICHT jeder Link
 * einzeln verdrahtet, sondern EIN Listener am Dokument faengt alle Klicks ab.
 * Neue Kontaktpunkte im Mirror sind damit automatisch erfasst.
 *
 * Zwei Regeln, die hier nicht verhandelbar sind:
 *
 *  · DER KLICK WIRD NIE AUFGEHALTEN. Kein preventDefault, kein Warten auf
 *    eine Antwort. `keepalive` sorgt dafuer, dass der Browser die Meldung
 *    auch dann zu Ende schickt, wenn die Seite im selben Moment zum Telefon,
 *    zu WhatsApp oder ins Mailprogramm wechselt.
 *  · KLICKS GEHEN DIREKT AN DEN OA-ENDPOINT, nicht ueber einen eigenen
 *    Server-Umweg. Nur so sieht der Endpoint die IP und den User-Agent des
 *    BESUCHERS — ueber einen Proxy saehe er immer nur den Vercel-Server,
 *    und die Ratenbegrenzung "40 Ereignisse je IP" wuerde alle Besucher in
 *    denselben Eimer werfen. Es gibt keinen Schluessel, der dabei sichtbar
 *    werden koennte.
 *
 * Die Formular-Anfrage meldet dagegen der Server (app/api/buchung/route.js):
 * Dort liegen die Felder vor, und gemeldet wird erst, wenn die Mail beim
 * Hotel wirklich raus ist.
 */
(function () {
  "use strict";

  var ENDPOINT =
    window.OA_EREIGNIS_ENDPOINT || "https://kunden.oawebagentur.de/api/ereignis";

  var KUNDE_ID = "el-capitan";

  /* ────────────────────────────────────────────────────────────────────
     Sitzung merken — einmal beim ersten Seitenaufruf.
     Wer ueber eine Anzeige kommt und erst auf der dritten Seite anruft,
     soll trotzdem der Anzeige zugerechnet werden.
     ──────────────────────────────────────────────────────────────────── */

  var SITZUNGSFELDER = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "wbraid",
    "gbraid",
  ];

  function setze(schluessel, wert) {
    try {
      if (wert && !sessionStorage.getItem("oa_" + schluessel)) {
        sessionStorage.setItem("oa_" + schluessel, wert);
      }
    } catch (e) {
      /* Privater Modus o. ae. — kein Grund, gar nichts zu melden. */
    }
  }

  function ausSitzung(schluessel) {
    try {
      return sessionStorage.getItem("oa_" + schluessel) || undefined;
    } catch (e) {
      return undefined;
    }
  }

  function kennung() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
    } catch (e) {}
    // Ersatz fuer alte Browser und unsichere Kontexte: reicht voellig, die
    // Kennung muss nur eine Sitzung von der naechsten unterscheiden.
    return (
      "s-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10)
    );
  }

  function sitzungMerken() {
    var p;
    try {
      p = new URLSearchParams(location.search);
    } catch (e) {
      p = null;
    }
    setze("sitzung", kennung());
    setze("landeseite", location.pathname);
    setze("referrer", document.referrer);
    if (p) {
      for (var i = 0; i < SITZUNGSFELDER.length; i++) {
        setze(SITZUNGSFELDER[i], p.get(SITZUNGSFELDER[i]));
      }
    }
  }

  sitzungMerken();

  /* ────────────────────────────────────────────────────────────────────
     Der gemeinsame Teil jedes Ereignisses. Wird auch von kontakt-form.js
     benutzt, damit die Formularanfrage dieselbe Herkunft bekommt wie ein
     Klick.
     ──────────────────────────────────────────────────────────────────── */

  function sitzungsdaten() {
    return {
      seite: location.pathname,
      seiteTitel: document.title,
      landeseite: ausSitzung("landeseite") || location.pathname,
      referrer: ausSitzung("referrer") || document.referrer || undefined,
      utm_source: ausSitzung("utm_source"),
      utm_medium: ausSitzung("utm_medium"),
      utm_campaign: ausSitzung("utm_campaign"),
      utm_term: ausSitzung("utm_term"),
      utm_content: ausSitzung("utm_content"),
      gclid: ausSitzung("gclid"),
      wbraid: ausSitzung("wbraid"),
      gbraid: ausSitzung("gbraid"),
      sprache: navigator.language,
      bildschirm: window.innerWidth + "x" + window.innerHeight,
      zeitzone: (function () {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch (e) {
          return undefined;
        }
      })(),
      sitzungId: ausSitzung("sitzung"),
    };
  }

  /**
   * Ereignis melden. Wirft nie, wartet nie, blockiert nie.
   */
  function meldeEreignis(art, extra) {
    var koerper = { kundeId: KUNDE_ID, art: art, webseite: "" };
    var daten = sitzungsdaten();
    var k;
    for (k in daten) {
      if (Object.prototype.hasOwnProperty.call(daten, k) && daten[k] != null) {
        koerper[k] = daten[k];
      }
    }
    if (extra) {
      for (k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k) && extra[k] != null) {
          koerper[k] = extra[k];
        }
      }
    }

    try {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify(koerper),
      }).catch(function () {});
    } catch (e) {
      /* Ein gescheitertes Reporting darf nie sichtbar werden. */
    }
  }

  /* ────────────────────────────────────────────────────────────────────
     CTA-Buttons kennzeichnen.

     Die Vorlage erwartet `data-oa-cta` an den Handlungsbuttons. Im
     gespiegelten HTML gibt es das nicht — es nachtraeglich in
     content/pages.json einzutragen hiesse, 500 KB Fremd-Markup von Hand zu
     pflegen. Stattdessen bekommen die Elementor-Buttons das Attribut hier,
     mit ihrer sichtbaren Beschriftung als Kennung. Telefon-, Mail- und
     WhatsApp-Links bleiben aussen vor: Die haben ihre eigene Art.
     ──────────────────────────────────────────────────────────────────── */

  function istKontaktweg(href) {
    return /^(tel:|mailto:|whatsapp:)/i.test(href) || /wa\.me|api\.whatsapp\.com/i.test(href);
  }

  function ctaKennzeichnen() {
    var buttons = document.querySelectorAll(
      "a.elementor-button:not([data-oa-cta])"
    );
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (istKontaktweg(b.getAttribute("href") || "")) continue;
      var text = (b.textContent || "").replace(/\s+/g, " ").trim();
      b.setAttribute("data-oa-cta", text.slice(0, 120) || "CTA");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ctaKennzeichnen);
  } else {
    ctaKennzeichnen();
  }

  /* ────────────────────────────────────────────────────────────────────
     Ein Listener fuer alle vier Klick-Arten — ohne preventDefault, in der
     Bubble-Phase. Der Browser macht mit dem Klick genau das, was er ohne
     dieses Skript auch getan haette.
     ──────────────────────────────────────────────────────────────────── */

  function whatsappNummer(href) {
    var treffer = href.replace(/^.*?(\+?\d[\d ]*).*$/, "$1").trim();
    return treffer || href;
  }

  function verarbeiteKlick(e) {
    var start = e.target;
    if (!start || typeof start.closest !== "function") return;

    // `a.elementor-button` steht bewusst mit im Selektor, nicht nur
    // `[data-oa-cta]`: Elementor blendet Inhalte auch nachtraeglich ein
    // (Popups, Slider). Ein Button, den ctaKennzeichnen() nie gesehen hat,
    // wird so trotzdem erfasst.
    var ziel = start.closest(
      "a[href^='tel:'], a[href^='mailto:'], a[href*='wa.me'], a[href*='api.whatsapp.com'], [data-oa-cta], a.elementor-button"
    );
    if (!ziel) return;

    var href = ziel.getAttribute("href") || "";

    if (/^tel:/i.test(href)) {
      meldeEreignis("telefon", { zielwert: href.slice(4) });
    } else if (/^mailto:/i.test(href)) {
      meldeEreignis("email", { zielwert: href.slice(7).split("?")[0] });
    } else if (/wa\.me|api\.whatsapp\.com/i.test(href)) {
      meldeEreignis("whatsapp", { zielwert: whatsappNummer(href) });
    } else {
      meldeEreignis("cta", {
        zielwert:
          ziel.getAttribute("data-oa-cta") ||
          (ziel.textContent || "").trim().slice(0, 120) ||
          "CTA",
      });
    }
  }

  document.addEventListener("click", verarbeiteKlick, false);

  // Mittelklick / "in neuem Tab oeffnen" loest kein `click` aus.
  document.addEventListener(
    "auxclick",
    function (e) {
      if (e.button === 1) verarbeiteKlick(e);
    },
    false
  );

  /* Fuer kontakt-form.js: Sitzungsdaten fuer die Formularmeldung. */
  window.oaTracking = {
    sitzungsdaten: sitzungsdaten,
    meldeEreignis: meldeEreignis,
  };
})();
