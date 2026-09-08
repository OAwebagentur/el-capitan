/*
 * Angebotskacheln ("Unsere aktuellen Angebote") klickbar machen.
 *
 * Die Kacheln liegen im Mirror als reine <img>-Elemente ohne Verlinkung --
 * ein Angebot wirbt, aber niemand kann draufklicken. Dieses Skript laeuft zur
 * Laufzeit (wie public/kontakt-form.js/oa-tracking.js), damit content/pages.json
 * als byte-genauer Mirror unangetastet bleibt: ein `npm run scrape` verliert
 * dadurch nichts, und die Aenderung sitzt an einer einzigen Stelle.
 *
 * Pro Kachel-Bild:
 *  - das ganze Bild wird in einen Link zur dirs21-Buchungsstrecke gepackt
 *    (target=_blank, rel=noopener -- Buchung laeuft auf fremder Domain),
 *  - direkt darunter kommt ein sichtbarer "Jetzt buchen"-Button dazu.
 * Beide Links tragen dieselbe dirs21-URL wie die uebrigen Buchungs-Buttons
 * der Seite, darum greift public/buchungsklick-tracking.js automatisch mit
 * (der Klick-Listener dort ist auf `a[href*="reservation.one.dirs21.de"]`
 * delegiert, egal ob der Link beim Laden schon da war oder erst durch
 * dieses Skript entsteht).
 *
 * Der Halloween-Kachel bekommt zusaetzlich einen vorbelegten Termin
 * mitgegeben (Halloween-Wochenende, 1 Nacht) -- siehe PROGRESS.md fuer die
 * Pruefung, dass dirs21 `range`/`los` als URL-Parameter versteht, ohne dass
 * dabei etwas gebucht wird.
 */
(function () {
  "use strict";

  var DIRS21_BASIS = "https://reservation.one.dirs21.de/el-capitan/result";
  // Halloween Horror Festival 26.09.-08.11.2026 -- Halloween-Wochenende als
  // Beispieltermin, 1 Nacht wie im Angebotstext. Besucher koennen Datum und
  // Gaesteanzahl im Buchungswidget jederzeit selbst anpassen.
  var DIRS21_HALLOWEEN =
    DIRS21_BASIS + "?range=2026-10-30,2026-10-31&los=1";

  var BUTTON_STYLE =
    "display:inline-block;background:#0099A1;color:#fff;padding:12px 24px;" +
    "border-radius:8px;font-weight:500;text-decoration:none;margin-top:14px;";

  function zielFuer(img) {
    var src = img.getAttribute("src") || "";
    return src.indexOf("halloween-movie-park-angebot-capitan-1x1") !== -1
      ? DIRS21_HALLOWEEN
      : DIRS21_BASIS;
  }

  function verlinken(img, ziel) {
    if (img.closest("a")) return; // schon verlinkt -- nicht doppelt umschliessen.
    var link = document.createElement("a");
    link.href = ziel;
    link.target = "_blank";
    link.rel = "noopener";
    link.setAttribute(
      "aria-label",
      "Zur Buchungsstrecke: " + (img.getAttribute("alt") || "Angebot")
    );
    img.parentNode.insertBefore(link, img);
    link.appendChild(img);
  }

  function buttonEinfuegen(nachElement, ziel) {
    var wrapper = document.createElement("div");
    wrapper.className = "ec-angebot-buchen";
    wrapper.style.cssText = "text-align:center;margin-top:6px;";
    var a = document.createElement("a");
    a.href = ziel;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Jetzt buchen";
    a.style.cssText = BUTTON_STYLE;
    wrapper.appendChild(a);
    nachElement.parentNode.insertBefore(wrapper, nachElement.nextSibling);
  }

  function init() {
    var bilder = document.querySelectorAll('img[src*="-angebot-capitan-1x1"]');
    for (var i = 0; i < bilder.length; i++) {
      var img = bilder[i];
      var ziel = zielFuer(img);
      var figure = img.closest("figure") || img;
      var naechstes = figure.nextElementSibling;
      var hatSchonButton =
        naechstes && naechstes.classList && naechstes.classList.contains("ec-angebot-buchen");

      verlinken(img, ziel);
      if (!hatSchonButton) buttonEinfuegen(figure, ziel);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
