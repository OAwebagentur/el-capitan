/*
 * Kontaktformular -> /api/buchung/
 *
 * Die gespiegelte Seite enthaelt ein Elementor-Pro-Formular, das urspruenglich
 * an die WordPress-"admin-ajax.php" gepostet haette. Die gibt es hier nicht
 * mehr, darum faengt dieses Skript das Absenden ab und schickt die Daten an
 * unsere eigene Next.js-API, die per Nodemailer eine E-Mail an das Hotel
 * verschickt.
 *
 * WICHTIG: Elementor Pro sendet das Formular nicht ueber ein natives
 * `submit`-Event, sondern faengt den KLICK auf den Submit-Button ab
 * (preventDefault) und ruft seinen AJAX direkt auf. Ein reiner
 * `submit`-Listener wird dadurch nie ausgeloest. Deshalb fangen wir
 * zusaetzlich den Button-Klick in der Capture-Phase ab (laeuft VOR Elementors
 * Klick-Handler). Der `submit`-Listener bleibt fuer die Enter-Taste erhalten.
 */
(function () {
  "use strict";

  var ENDPOINT = "/api/buchung/";

  // "Buchungsformular" ist der alte Name desselben Formulars. Er wird noch
  // erkannt, damit eine Seite, die ein Besucher vor der Umstellung geladen
  // hat, weiterhin abgesendet werden kann statt still ins Leere zu laufen.
  var NAMEN = ["Kontaktformular", "Buchungsformular"];

  function isKontaktformular(el) {
    return (
      el &&
      el.tagName === "FORM" &&
      el.classList.contains("elementor-form") &&
      NAMEN.indexOf(el.getAttribute("name")) !== -1
    );
  }

  // Manche gespiegelten Felder (z. B. Telefon) tragen ein `pattern`, das mit
  // dem modernen `v`-Flag der Browser-Validierung ungueltig ist und beim
  // Aufruf von checkValidity()/reportValidity() eine Exception wirft. Solche
  // ungueltigen Muster entfernen wir, damit die Validierung nicht bricht.
  function sanitizePatterns(form) {
    var fields = form.querySelectorAll("[pattern]");
    for (var i = 0; i < fields.length; i++) {
      var p = fields[i].getAttribute("pattern");
      if (p == null) continue;
      // Moderne Browser kompilieren `pattern` mit dem `v`-Flag. Wirft das,
      // bricht die gesamte Formular-Validierung – dann Attribut entfernen.
      try {
        new RegExp(p, "v");
      } catch (e) {
        fields[i].removeAttribute("pattern");
      }
    }
  }

  // Honeypot fuer das OA-Reporting: ein Feld, das nur ein Bot ausfuellt.
  // Bewusst KEIN type="hidden" — das ueberspringen Formular-Bots gezielt.
  // Ist es befuellt, nimmt der OA-Endpoint die Meldung an und schreibt
  // nichts. Auf den eigenen Mailversand hat es keinen Einfluss.
  function honeypotEinbauen(form) {
    if (form.querySelector('input[name="webseite"]')) return;
    var feld = document.createElement("input");
    feld.type = "text";
    feld.name = "webseite";
    feld.tabIndex = -1;
    feld.autocomplete = "off";
    feld.setAttribute("aria-hidden", "true");
    feld.style.cssText =
      "position:absolute;left:-9999px;width:1px;height:1px;opacity:0;";
    form.appendChild(feld);
  }

  function honeypotWert(form) {
    var feld = form.querySelector('input[name="webseite"]');
    return feld ? feld.value : "";
  }

  function showMessage(form, type, text) {
    var box = form.querySelector(".ec-form-message");
    if (!box) {
      box = document.createElement("div");
      box.className = "ec-form-message";
      box.style.cssText =
        "margin-top:16px;padding:12px 16px;border-radius:4px;font-size:15px;line-height:1.5;";
      form.appendChild(box);
    }
    if (type === "success") {
      box.style.background = "#e7f4e4";
      box.style.color = "#256029";
      box.style.border = "1px solid #b7dfb0";
    } else if (type === "error") {
      box.style.background = "#fdeaea";
      box.style.color = "#8a1f1f";
      box.style.border = "1px solid #f3b9b9";
    } else {
      box.style.background = "#f3efe7";
      box.style.color = "#6b5a3e";
      box.style.border = "1px solid #ddd2bd";
    }
    box.textContent = text;
    return box;
  }

  function collectFields(form) {
    var data = {};
    var inputs = form.querySelectorAll('[name^="form_fields"]');
    inputs.forEach(function (input) {
      var name = input.getAttribute("name");
      if (!name) return;
      if (
        (input.type === "checkbox" || input.type === "radio") &&
        !input.checked
      ) {
        return;
      }
      data[name] = input.value;
    });
    return data;
  }

  function submitForm(form) {
    // Mehrfachversand verhindern.
    if (form.__ecSubmitting) return;

    sanitizePatterns(form);

    // HTML5-Pflichtfeldpruefung (inkl. Datenschutz-Checkbox) nutzen.
    var valid = true;
    try {
      if (typeof form.checkValidity === "function") valid = form.checkValidity();
    } catch (e) {
      valid = true; // Bei kaputter Validierung lieber senden als blockieren.
    }
    if (!valid) {
      try {
        if (typeof form.reportValidity === "function") form.reportValidity();
      } catch (e) {}
      return;
    }

    form.__ecSubmitting = true;

    var button = form.querySelector('button[type="submit"]');
    var textSpan = button && button.querySelector(".elementor-button-text");
    var originalLabel = textSpan ? textSpan.textContent : null;

    if (button) button.disabled = true;
    if (textSpan) textSpan.textContent = "Wird gesendet …";
    showMessage(form, "info", "Ihre Nachricht wird gesendet …");

    // Herkunft der Sitzung mitschicken (Kampagne, Landeseite, Referrer),
    // damit die Anfrage im OA-Reporting derselben Quelle zugeordnet wird
    // wie ein Telefon- oder WhatsApp-Klick. Gemeldet wird sie serverseitig,
    // erst nachdem die Mail beim Hotel raus ist. Fehlt oa-tracking.js, geht
    // das Formular ohne Kontext raus — der Versand haengt nie daran.
    var oaKontext = null;
    try {
      if (
        window.oaTracking &&
        typeof window.oaTracking.sitzungsdaten === "function"
      ) {
        oaKontext = window.oaTracking.sitzungsdaten();
      }
    } catch (e) {}

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        form_fields: collectFields(form),
        oa_kontext: oaKontext,
        webseite: honeypotWert(form),
      }),
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (json) {
            return { ok: res.ok, json: json };
          });
      })
      .then(function (result) {
        if (result.ok && result.json && result.json.success) {
          showMessage(
            form,
            "success",
            "Vielen Dank! Ihre Nachricht wurde versendet. Wir melden uns in Kürze bei Ihnen."
          );
          form.reset();
        } else {
          var msg =
            (result.json && result.json.error) ||
            "Die Anfrage konnte nicht versendet werden. Bitte versuchen Sie es später erneut.";
          showMessage(form, "error", msg);
        }
      })
      .catch(function () {
        showMessage(
          form,
          "error",
          "Verbindung fehlgeschlagen. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut."
        );
      })
      .finally(function () {
        form.__ecSubmitting = false;
        if (button) button.disabled = false;
        if (textSpan && originalLabel != null) {
          textSpan.textContent = originalLabel;
        }
      });
  }

  // 1) Button-Klick in der Capture-Phase: laeuft VOR Elementors Klick-Handler
  //    und verhindert dessen (ins Leere laufenden) admin-ajax.php-Aufruf.
  document.addEventListener(
    "click",
    function (e) {
      var target = e.target;
      if (!target || typeof target.closest !== "function") return;
      var button = target.closest(
        'button[type="submit"], input[type="submit"]'
      );
      if (!button) return;
      var form = button.form || button.closest("form");
      if (!isKontaktformular(form)) return;

      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }
      submitForm(form);
    },
    true
  );

  // 2) Natives submit-Event (z. B. Enter-Taste) ebenfalls abfangen.
  document.addEventListener(
    "submit",
    function (e) {
      var form = e.target;
      if (!isKontaktformular(form)) return;

      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }
      submitForm(form);
    },
    true
  );

  // Ungueltige pattern-Attribute frueh entschaerfen, damit auch die native
  // Validierung beim Tippen nicht in eine Exception laeuft.
  function init() {
    var forms = document.querySelectorAll(
      'form[name="Kontaktformular"], form[name="Buchungsformular"]'
    );
    for (var i = 0; i < forms.length; i++) {
      sanitizePatterns(forms[i]);
      honeypotEinbauen(forms[i]);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
