/* waitlist.js — 事前登録フォーム送信（ヒーロー＋終盤の2か所）
   GitHub Pages 上でも動くよう、Netlify（pocket-todo.netlify.app）の
   既存 "waitlist" フォームへ no-cors で POST する。送信後はその場で謝意を出す。
   JS が無効/失敗しても、<form action=...> の素のPOSTでNetlifyに届くフォールバック付き。 */
(function () {
  'use strict';
  var ENDPOINT = 'https://pocket-todo.netlify.app/';
  var forms = document.querySelectorAll('form.wl-form');
  if (!forms.length) return;

  Array.prototype.forEach.call(forms, function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.querySelector('input[type="email"]');
      if (email && !email.checkValidity()) { email.reportValidity(); return; }

      var body = new URLSearchParams(new FormData(form)).toString();
      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = '送信中…'; }
      var thanks = form.dataset.thanks ? document.getElementById(form.dataset.thanks) : null;

      var done = function () {
        form.style.display = 'none';
        if (thanks) { thanks.hidden = false; requestAnimationFrame(function () { thanks.classList.add('is-settled'); }); }
      };
      fetch(ENDPOINT, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      }).then(done).catch(done);
    });
  });
})();
