/* time.js — スクロール＝一日の時刻 (--t) エンジン
   スクロール進行を慣性つきで平滑化し、時刻パレットを連続補間して CSS変数へ流す。
   静けさの担保：無操作で完全に idle（rAFを止める）。呼吸は CSS/WebGL 側に委ね、ここは時刻だけ。 */
(function () {
  'use strict';
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 一日の時刻パレット stop: [t, paper, ink, ink2, ink3, hair, sky]
  // コントラスト方針：日中は ink2≧4.5:1 / ink3≧3:1。夜への反転は「地が暗くなってから文字を白へ」
  // 反転の交差帯は 0.88→0.905 の 0.025 と極短で、ここに本文は載らない（おやすみは深墨で初めて出る）。
  const STOPS = [
    [0.00, [236,234,230],[28,27,25],[92,88,82], [120,115,107],[224,221,216],[230,231,234]], // 夜明け前
    [0.12, [246,245,242],[28,27,25],[92,88,82], [120,115,107],[231,228,221],[247,246,242]], // 朝
    [0.36, [248,247,244],[28,27,25],[90,86,80], [118,113,105],[233,230,224],[250,249,246]], // 昼
    [0.60, [244,240,234],[40,34,30],[100,92,83],[126,117,106],[230,222,212],[242,236,226]], // 夕
    [0.78, [230,224,217],[34,32,29],[98,91,83], [124,116,106],[216,208,200],[224,217,208]], // 夕闇
    [0.88, [150,144,137],[40,38,34],[80,76,70], [100,96,89], [150,144,137],[150,144,137]],  // 宵（暗墨・まだ読める）
    [0.905,[44,42,38],  [228,224,216],[150,145,136],[122,118,110],[60,58,52],[40,38,33]],    // 反転完了（白文字）
    [1.00, [28,27,25],  [237,234,227],[167,162,153],[122,118,110],[51,50,43],[20,20,15]],    // 深墨（クライマックス）
  ];

  function lerp(a, b, k) { return a + (b - a) * k; }
  function lerpRGB(a, b, k) { return [Math.round(lerp(a[0],b[0],k)), Math.round(lerp(a[1],b[1],k)), Math.round(lerp(a[2],b[2],k))]; }

  function palette(t) {
    if (t <= STOPS[0][0]) t = STOPS[0][0];
    if (t >= STOPS[STOPS.length - 1][0]) t = STOPS[STOPS.length - 1][0];
    let i = 0;
    for (; i < STOPS.length - 1; i++) { if (t <= STOPS[i + 1][0]) break; }
    const lo = STOPS[i], hi = STOPS[Math.min(i + 1, STOPS.length - 1)];
    const span = (hi[0] - lo[0]) || 1;
    const k = Math.min(1, Math.max(0, (t - lo[0]) / span));
    return {
      paper: lerpRGB(lo[1], hi[1], k), ink: lerpRGB(lo[2], hi[2], k),
      ink2: lerpRGB(lo[3], hi[3], k), ink3: lerpRGB(lo[4], hi[4], k),
      hair: lerpRGB(lo[5], hi[5], k), sky: lerpRGB(lo[6], hi[6], k),
    };
  }
  const rgb = (c) => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  const metaTheme = document.querySelector('meta[name="theme-color"]');

  let lastKey = '';
  function apply(t) {
    const key = t.toFixed(4);
    if (key === lastKey) return;          // 丸めて変化なし＝全 setProperty をスキップ
    lastKey = key;
    const p = palette(t);
    root.style.setProperty('--t', key);
    root.style.setProperty('--paper', rgb(p.paper));
    root.style.setProperty('--ink', rgb(p.ink));
    root.style.setProperty('--ink2', rgb(p.ink2));
    root.style.setProperty('--ink3', rgb(p.ink3));
    root.style.setProperty('--hair', rgb(p.hair));
    root.style.setProperty('--sky', rgb(p.sky));
    // 呼吸背景（WebGL）へ色を共有。安全な既定つき。
    const s = window.__sky || (window.__sky = { paper: [246,245,242], ink: [28,27,25], breath: 1 });
    s.paper = p.paper; s.ink = p.ink;
    if (metaTheme) metaTheme.setAttribute('content', rgb(p.sky));
  }

  // scrollHeight は resize/load 時のみ再計測してキャッシュ（scroll中の forced reflow を回避）
  let docMax = 1;
  function measure() { docMax = Math.max(1, root.scrollHeight - innerHeight); }
  function progress() { return Math.min(1, Math.max(0, scrollY / docMax)); }
  measure();

  // モード別に「更新トリガ」を1つに統一（reduce/通常で二重定義せず TDZ を回避）
  let onMeasure = function () {};
  addEventListener('resize', () => { measure(); onMeasure(); }, { passive: true });
  addEventListener('load', () => { measure(); onMeasure(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); onMeasure(); });

  if (reduce) {
    // ---- reduced-motion：平滑化なしで即同期。rAF を一切持たない ----
    const onScroll = () => apply(progress());
    addEventListener('scroll', onScroll, { passive: true });
    onMeasure = onScroll;
    onScroll();
  } else {
    // ---- 通常：慣性つき。settle したら rAF を止めて完全 idle ----
    let cur = progress(), running = false;
    const tick = () => {
      const target = progress();           // 毎フレーム再評価（遅延画像で高さが伸びても破綻しない）
      cur += (target - cur) * 0.08;
      if (Math.abs(target - cur) < 0.0004) { cur = target; apply(cur); running = false; return; }
      apply(cur);
      requestAnimationFrame(tick);
    };
    const kick = () => { if (!document.hidden && !running) { running = true; requestAnimationFrame(tick); } };
    onMeasure = kick;
    addEventListener('scroll', kick, { passive: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
    apply(cur);
  }
})();
