/* reveal.js — 定着・立ち上がり・きせかえ6色一巡・夜のクライマックス
   要素は画面に入ったとき一度だけ静かに「定着」する（書いたものは消えない＝出ても戻さない）。 */
(function () {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const all = document.querySelectorAll('[data-settle], [data-rise]');

  // IO 非対応／reduced-motion：全要素を即定着させ、版面を確実に成立させる
  function settleAll() {
    all.forEach((el) => el.classList.add('is-settled'));
    const g = document.getElementById('goodnight'); if (g) g.classList.add('is-settled');
    const c = document.getElementById('nightCta'); if (c) c.classList.add('is-settled');
  }
  if (reduce || !('IntersectionObserver' in window)) { settleAll(); startCycle(true); return; }

  // ===== 定着・立ち上がり（once）。交差した瞬間だけ will-change を付け、終わったら外す =====
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.style.willChange = 'opacity, letter-spacing, transform, filter';
      el.classList.add('is-settled');
      io.unobserve(el);
      const clear = () => { el.style.willChange = 'auto'; el.removeEventListener('transitionend', clear); };
      el.addEventListener('transitionend', clear);
      setTimeout(clear, 2600);   // transitionend が来ない場合の保険
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
  all.forEach((el) => io.observe(el));

  // ===== きせかえ：6色一巡（#kisekae が見えている間だけ・呼気リズムで） =====
  function startCycle(immediate) {
    const el = document.getElementById('kisekae');
    if (!el) return;
    const COLORS = [
      'rgb(28,27,25)',    // すみ（墨）
      'rgb(90,46,28)',    // よあけ（褐）
      'rgb(60,90,69)',    // もり（森）
      'rgb(30,58,72)',    // なぎさ（藍）
      'rgb(140,66,89)',   // さくら（薔薇）
      'rgb(42,42,36)',    // ダーク（炭）
    ];
    let idx = 0, timer = null;
    el.style.setProperty('--cycle-color', COLORS[0]);
    if (immediate) return;
    function step() { idx = (idx + 1) % COLORS.length; el.style.setProperty('--cycle-color', COLORS[idx]); }
    function run() { if (!timer) timer = setInterval(step, 2400); }   // 各色2.4s停留（賑やかさを抑える）
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    new IntersectionObserver((es) => {
      es.forEach((e) => { e.isIntersecting ? run() : stop(); });
    }, { threshold: 0.4 }).observe(el);
  }
  startCycle(false);

  // ===== 夜のクライマックス（背の高いセクションでも確実に発火・発火後 disconnect） =====
  const night = document.getElementById('night');
  const lastTask = document.getElementById('lastTask');
  const goodnight = document.getElementById('goodnight');
  const nightCta = document.getElementById('nightCta');
  if (night && goodnight) {
    let fired = false;
    const nightMark = night.querySelector('.night-mark');
    const fire = () => {
      if (fired) return; fired = true;
      // 反転の交差帯では読ませる文字を画面から退かせ、muddyな一瞬を無害化する
      if (nightMark) nightMark.classList.add('fade-away');
      setTimeout(() => { if (lastTask) lastTask.classList.add('fade-away'); }, 450);
      setTimeout(() => goodnight.classList.add('is-settled'), 1100);
      if (nightCta) setTimeout(() => nightCta.classList.add('is-settled'), 2000);
    };
    const nio = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.25) { fire(); nio.disconnect(); }
      });
    }, { threshold: [0, 0.25, 0.55], rootMargin: '0px 0px -25% 0px' });
    nio.observe(night);
    // 安全網：最下部近くまで来たら必ず発火
    addEventListener('scroll', function onsc() {
      if (scrollY + innerHeight >= document.documentElement.scrollHeight - 80) { fire(); removeEventListener('scroll', onsc); }
    }, { passive: true });
  }
})();
