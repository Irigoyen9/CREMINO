/* WhatsApp de Cremino: enlaces con mensaje pre-rellenado y, en pedidos.html,
   un formulario que compone el pedido para llevar automáticamente.

   Los mensajes que se envían van SIN emojis: al pasar por el enlace de WhatsApp,
   algunos dispositivos (WhatsApp de escritorio, móviles antiguos) los reciben
   como "?". En su lugar se usa el formato propio de WhatsApp (*negrita*). */
(function () {
  var PHONE = "34613033836";
  var DEFAULT_MSG = "Hola, Cremino. Quería hacer un pedido para llevar.";

  // Horario de temporada (minutos desde las 00:00; más de 1440 = pasada la
  // medianoche). 0 = domingo ... 6 = sábado. Se recoge hasta media hora
  // antes de cerrar. Si cambia el horario, se toca aquí, en js/main.js
  // (HORARIO) y en las tablas de horario del HTML.
  var HORARIO = {
    0: [780, 1530],
    1: [840, 1530],
    2: [840, 1530],
    3: [840, 1530],
    4: [840, 1530],
    5: [840, 1560],
    6: [780, 1560]
  };
  var STEP = 30;
  var CLOSED_DAYS = [];

  // Quita cualquier emoji o pictograma que se cuele en un mensaje
  var EMOJI_RE = /(?:[←-⯿☀-➿️‍⃣]|[\uD83C-\uDBFF][\uDC00-\uDFFF])/g;

  function cleanMessage(message) {
    return message
      .replace(EMOJI_RE, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function buildLink(message) {
    return "https://api.whatsapp.com/send?phone=" + PHONE + "&text=" + encodeURIComponent(cleanMessage(message));
  }

  document.querySelectorAll("[data-wa]").forEach(function (el) {
    var message = el.getAttribute("data-wa-message") || DEFAULT_MSG;
    el.setAttribute("href", buildLink(message));
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener");
  });

  /* ---- Formulario de pedido para llevar ---- */
  var DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function toISODate(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseISO(iso) { var p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function prettyDate(iso) { var d = parseISO(iso); return DIAS[d.getDay()] + " " + d.getDate() + " de " + MESES[d.getMonth()]; }
  function dayOf(iso) { return iso ? parseISO(iso).getDay() : -1; }
  function isClosed(iso) { return !!iso && CLOSED_DAYS.indexOf(dayOf(iso)) !== -1; }
  function closedText() { return "Ese día no abrimos. Elige otro día."; }
  function lastPickup(day) { return HORARIO[day][1] - 30; }

  function checkedValues(form, name) {
    return Array.prototype.map.call(
      form.querySelectorAll('input[name="' + name + '"]:checked'),
      function (i) { return i.value; }
    );
  }

  function fillTimes(form, iso) {
    var select = form.hora;
    var previous = select.value;
    if (!iso || isClosed(iso)) {
      select.innerHTML = '<option value="">' + (iso ? "Ese día no abrimos" : "Elige primero el día") + "</option>";
      return;
    }
    var day = dayOf(iso);
    var now = new Date();
    var isToday = iso === toISODate(now);
    var minutesNow = now.getHours() * 60 + now.getMinutes();
    select.innerHTML = '<option value="">Elige la hora</option>';
    for (var m = HORARIO[day][0]; m <= lastPickup(day); m += STEP) {
      if (isToday && m < minutesNow + 30) continue;
      var label = pad(Math.floor(m / 60) % 24) + ":" + pad(m % 60);
      var opt = document.createElement("option");
      if (m >= 1440) label += " (de madrugada)";
      opt.value = label;
      opt.textContent = label;
      select.appendChild(opt);
    }
    if (select.options.length === 1) select.innerHTML = '<option value="">Ya no quedan horas hoy</option>';
    if (previous && select.querySelector('option[value="' + previous + '"]')) select.value = previous;
  }

  function composeMessage(form) {
    var data = {
      nombre: form.nombre.value.trim(),
      productos: checkedValues(form, "productos"),
      fecha: form.fecha.value,
      hora: form.hora.value,
      personas: form.personas.value,
      local: checkedValues(form, "local")[0] || "",
      extras: checkedValues(form, "extras"),
      notas: form.notas.value.trim()
    };
    var lines = ["Hola, Cremino. Quería hacer un pedido para llevar:", ""];
    lines.push("*Nombre:* " + (data.nombre || "..."));
    lines.push("*Pedido:* " + (data.productos.length ? data.productos.join(", ") : "..."));
    lines.push("*Para:* " + (data.personas ? data.personas + (data.personas === "1" ? " persona" : " personas") : "..."));
    lines.push("*Recojo en:* " + (data.local || "..."));
    lines.push("*Día:* " + (data.fecha ? prettyDate(data.fecha) : "..."));
    lines.push("*Hora:* " + (data.hora || "..."));
    if (data.extras.length) lines.push("*Además:* " + data.extras.join(", "));
    if (data.notas) lines.push("*Sabores y detalles:* " + cleanMessage(data.notas));
    lines.push("", "¿Me lo confirmáis? Muchas gracias.");
    return { text: lines.join("\n"), data: data };
  }

  function firstOpenDay(from) {
    var d = new Date(from);
    // Si ya ha pasado la última recogida de hoy, empezamos mañana
    var mins = d.getHours() * 60 + d.getMinutes();
    if (mins > lastPickup(d.getDay()) - 30) d.setDate(d.getDate() + 1);
    for (var i = 0; i < 7 && CLOSED_DAYS.indexOf(d.getDay()) !== -1; i++) d.setDate(d.getDate() + 1);
    return d;
  }

  document.querySelectorAll(".js-reserve-form").forEach(function (form) {
    var dateInput = form.fecha;
    var preview = form.querySelector(".reserve-form__preview");
    var error = form.querySelector(".reserve-form__error");

    var today = new Date();
    var max = new Date();
    max.setMonth(max.getMonth() + 3);
    dateInput.min = toISODate(today);
    dateInput.max = toISODate(max);
    if (!dateInput.value) dateInput.value = toISODate(firstOpenDay(today));

    fillTimes(form, dateInput.value);

    function refresh() {
      if (!preview) return;
      // Vista previa como la verá la heladería: *texto* en negrita, igual que WhatsApp
      preview.textContent = "";
      composeMessage(form).text.split(/(\*[^*\n]+\*)/).forEach(function (part) {
        if (/^\*[^*\n]+\*$/.test(part)) {
          var b = document.createElement("strong");
          b.textContent = part.slice(1, -1);
          preview.appendChild(b);
        } else {
          preview.appendChild(document.createTextNode(part));
        }
      });
    }

    dateInput.addEventListener("change", function () {
      fillTimes(form, dateInput.value);
      if (error) error.textContent = isClosed(dateInput.value) ? closedText() : "";
      refresh();
    });
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    refresh();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (isClosed(dateInput.value)) {
        if (error) error.textContent = closedText();
        return;
      }
      var result = composeMessage(form);
      var d = result.data;
      var missing = [];
      if (!d.productos.length) missing.push("qué te preparamos");
      if (!d.nombre) missing.push("tu nombre");
      if (!d.personas) missing.push("para cuántos es");
      if (!d.fecha) missing.push("el día");
      if (!d.hora) missing.push("la hora");
      if (missing.length) {
        if (error) error.textContent = "Nos falta " + missing.join(", ") + ".";
        return;
      }
      if (error) error.textContent = "";
      var link = buildLink(result.text);
      // Sin "noopener" en features: con él window.open devuelve siempre null
      // y no sabríamos si el navegador bloqueó la pestaña.
      var win = window.open(link, "_blank");
      if (win) win.opener = null;
      else window.location.href = link;
    });
  });
})();
