/*
 * Buchungsformular -> /api/buchung/
 *
 * Die gespiegelte Seite enthaelt ein Elementor-Formular, das urspruenglich an
 * die WordPress-"admin-ajax.php" gepostet haette. Die gibt es hier nicht mehr,
 * darum faengt dieses Skript das Absenden ab und schickt die Daten an unsere
 * eigene Next.js-API, die per Nodemailer eine E-Mail an das Hotel verschickt.
 *
 * Das Abfangen passiert in der Capture-Phase auf `document`: dadurch laeuft es
 * VOR dem Submit-Handler, den Elementor direkt am <form> registriert, und
 * stoppt dessen (ins Leere laufenden) AJAX-Aufruf zuverlaessig.
 */
(function () {
  "use strict";

  var ENDPOINT = "/api/buchung/";

  function isBuchungsformular(el) {
    return (
      el &&
      el.tagName === "FORM" &&
      el.classList.contains("elementor-form") &&
      el.getAttribute("name") === "Buchungsformular"
    );
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

  function handleSubmit(e) {
    var form = e.target;
    if (!isBuchungsformular(form)) return;

    // Das Original-Verhalten (Elementor-AJAX / normaler POST) komplett stoppen.
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") {
      e.stopImmediatePropagation();
    }

    // HTML5-Pflichtfeldpruefung (inkl. Datenschutz-Checkbox) nutzen.
    if (typeof form.checkValidity === "function" && !form.checkValidity()) {
      if (typeof form.reportValidity === "function") form.reportValidity();
      return;
    }

    var button = form.querySelector('button[type="submit"]');
    var textSpan = button && button.querySelector(".elementor-button-text");
    var originalLabel = textSpan ? textSpan.textContent : null;

    if (button) button.disabled = true;
    if (textSpan) textSpan.textContent = "Wird gesendet …";
    showMessage(form, "info", "Ihre Anfrage wird gesendet …");

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ form_fields: collectFields(form) }),
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
            "Vielen Dank! Ihre unverbindliche Anfrage wurde versendet. Wir melden uns in Kürze bei Ihnen."
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
        if (button) button.disabled = false;
        if (textSpan && originalLabel != null) {
          textSpan.textContent = originalLabel;
        }
      });
  }

  // Capture-Phase: laeuft vor dem Elementor-Handler am Formular.
  document.addEventListener("submit", handleSubmit, true);
})();
