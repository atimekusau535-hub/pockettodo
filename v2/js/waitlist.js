/* waitlist.js — 事前登録フォーム送信
   GitHub Pages 上でも動くよう、Netlify（pocket-todo.netlify.app）の
   既存 "waitlist" フォームへ no-cors で POST する。送信後はその場で謝意を出す。
   JS が無効/失敗しても、<form action=...> の素のPOSTでNetlifyに届くフォールバック付き。 */
(function () {
  'use strict';
  var form = document.getElementById('waitlist');
  if (!form) return;
  var thanks = document.getElementById('wlThanks');
  var ENDPOINT = 'https://pocket-todo.netlify.app/';

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = form.querySelector('input[type="email"]');
    if (email && !email.checkValidity()) { email.reportValidity(); return; }

    var body = new URLSearchParams(new FormData(form)).toString();
    var btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = '送信中…'; }

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
})();
