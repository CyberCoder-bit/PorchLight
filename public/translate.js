// Optional extras for the conversation helper (/translate), loaded only on that page.
// The page works fully without this file. Where the browser supports them, it adds:
//   - a "Speak" button by each text box (speech recognition, Web Speech API)
//   - a "Read aloud" button by each translation (speech synthesis)
// Button words come from the form's data-* attributes, so they follow the page language.
// Speech recognition may be handled by the browser maker's own service; it is the
// person's choice to press the button.
(function () {
  'use strict';
  var form = document.getElementById('helper-form');
  if (!form) return;
  var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var canRead = 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

  function button(text) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'button button-secondary button-small';
    b.textContent = text;
    return b;
  }

  ['mine', 'theirs'].forEach(function (id) {
    var box = document.getElementById('field-' + id);
    var select = form.elements[id + 'Lang'];
    if (box && Recognition) {
      var listening = null;
      var speak = button(form.dataset.speak || 'Speak');
      speak.setAttribute('aria-pressed', 'false');
      speak.addEventListener('click', function () {
        if (listening) {
          listening.stop();
          return;
        }
        var rec = new Recognition();
        rec.lang = (select && select.value) || document.documentElement.lang || 'en';
        rec.interimResults = false;
        rec.onresult = function (event) {
          var heard = '';
          for (var i = event.resultIndex; i < event.results.length; i++) heard += event.results[i][0].transcript;
          box.value = (box.value ? box.value.replace(/\s+$/, '') + ' ' : '') + heard.trim();
        };
        rec.onend = function () {
          listening = null;
          speak.textContent = form.dataset.speak || 'Speak';
          speak.setAttribute('aria-pressed', 'false');
        };
        rec.onerror = rec.onend;
        listening = rec;
        speak.textContent = form.dataset.stop || 'Stop';
        speak.setAttribute('aria-pressed', 'true');
        try {
          rec.start();
        } catch (e) {
          rec.onend();
        }
      });
      var holder = document.createElement('p');
      holder.appendChild(speak);
      box.parentNode.appendChild(holder);
    }

    var out = document.getElementById('out-' + id);
    if (out && canRead) {
      var read = button(form.dataset.read || 'Read aloud');
      read.addEventListener('click', function () {
        window.speechSynthesis.cancel();
        var say = new window.SpeechSynthesisUtterance(out.textContent);
        say.lang = out.getAttribute('data-read-lang') || out.lang || 'en';
        window.speechSynthesis.speak(say);
      });
      var p = document.createElement('p');
      p.appendChild(read);
      out.parentNode.insertBefore(p, out.nextSibling);
    }
  });
})();
