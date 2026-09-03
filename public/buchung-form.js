/*
 * Alter Dateiname des Formular-Skripts (bis 03.09.2026).
 *
 * Ausgeliefert wird jetzt /kontakt-form.js. Diese Datei bleibt bestehen, weil
 * eine Seite, die ein Besucher vor der Umstellung geladen hat, weiterhin
 * /buchung-form.js anfordert. Ohne sie liefe das Absenden dort ins Leere:
 * Elementor wuerde auf die im Mirror nicht vorhandene admin-ajax.php posten
 * und die Anfrage waere ohne Fehlermeldung verloren.
 */
(function () {
  "use strict";
  var s = document.createElement("script");
  s.src = "/kontakt-form.js";
  s.defer = true;
  document.head.appendChild(s);
})();
