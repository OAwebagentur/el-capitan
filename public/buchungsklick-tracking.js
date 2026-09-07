/*
 * Buchungsklick -> Meta Pixel + GA4.
 *
 * Gebucht wird ausschliesslich auf der fremden dirs21-Domain
 * (https://reservation.one.dirs21.de/el-capitan/result), die eigene Seite
 * sieht den eigentlichen Buchungsabschluss nie. Ohne ein Ereignis am Klick
 * dorthin kann Meta nur auf Klicks optimieren, nicht auf Buchungsabsicht --
 * genau das soll die geplante Meta-Kampagne aber koennen.
 *
 * Beide Plattformen bekommen den STANDARD-Namen fuer "Checkout begonnen"
 * statt eines frei erfundenen Custom-Events:
 *   - Meta:  InitiateCheckout  (Standard-Ereignis, von der Meta-Kampagnen-
 *            optimierung direkt verstanden, im Unterschied zu einem
 *            benannten Custom Event ohne Sonderbehandlung)
 *   - GA4:   begin_checkout    (von Google als empfohlenes Ecommerce-
 *            Ereignis dokumentiert)
 * Damit ist der Klick auf beiden Seiten ein bekanntes Signal und nicht nur
 * ein Rohwert, den niemand automatisch einordnet.
 *
 * Meta-Pixel (fbq) und gtag laufen bereits inline im <head> der gespiegelten
 * Seite -- dieses Skript ruft sie nur auf, es baut sie nicht neu auf. Der
 * Klick wird nie aufgehalten: kein preventDefault, kein Warten auf eine
 * Antwort. fbq/gtag senden selbst per Beacon/keepalive, auch wenn die Seite
 * im selben Moment zu dirs21 wechselt.
 */
(function () {
  "use strict";

  function istDirs21Link(href) {
    return /^https?:\/\/reservation\.one\.dirs21\.de\//i.test(href || "");
  }

  function melden(ziel) {
    var href = ziel.getAttribute("href") || "";

    try {
      if (typeof window.fbq === "function") {
        window.fbq("track", "InitiateCheckout", {
          content_name: "El Capitan Buchung",
          content_category: "Hotelbuchung",
        });
      }
    } catch (e) {
      /* Ein gescheitertes Pixel-Ereignis darf den Klick nie aufhalten. */
    }

    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", "begin_checkout", {
          currency: "EUR",
          items: [{ item_name: "El Capitan Buchung" }],
        });
      }
    } catch (e) {}

    if (typeof window.console !== "undefined" && window.console.debug) {
      window.console.debug("[buchungsklick-tracking] InitiateCheckout / begin_checkout ->", href);
    }
  }

  function verarbeiteKlick(e) {
    var start = e.target;
    if (!start || typeof start.closest !== "function") return;
    var ziel = start.closest("a[href]");
    if (!ziel || !istDirs21Link(ziel.getAttribute("href"))) return;
    melden(ziel);
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
})();
