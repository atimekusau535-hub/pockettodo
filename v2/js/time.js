/* time.js — スクロール＝一日の時刻 (--t) エンジン
   時刻パレット・空のグロー・太陽/月の運行を1つの t から連続駆動する。
   静けさの担保：無操作で完全に idle（rAFを止める）。呼吸は CSS/WebGL 側に委ねる。 */
(function () {
  'use strict';
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 時刻パレット stop: [t, paper, ink, ink2, ink3, hair, sky]
  // 可読性方針：日中は ink2≈7:1 / ink3≈4:1。夜反転は「地が暗くなってから文字を白へ」（交差帯 0.88→0.905）
  const STOPS = [
    // ink3（5列目）は小さな文字に使うため、日中は約6:1まで濃くして可読性を確保
    [0.00, [236,234,230],[28,27,25],[76,72,66],[94,89,81], [224,221,216],[228,229,233]],
    [0.12, [246,245,242],[28,27,25],[76,72,66],[94,89,81], [231,228,221],[247,246,242]],
    [0.36, [248,247,244],[28,27,25],[74,70,64],[92,87,80], [233,230,224],[250,249,246]],
    [0.60, [244,240,234],[40,34,30],[84,76,67],[100,91,81],[230,222,212],[243,236,225]],
    [0.78, [230,224,217],[34,32,29],[82,75,67],[98,91,82], [216,208,200],[223,215,205]],
    [0.88, [150,144,137],[40,38,34],[70,66,60],[86,82,76], [150,144,137],[148,142,136]],
    [0.905,[44,42,38],  [228,224,216],[150,145,136],[156,152,144],[60,58,52],[36,36,40]],
    [1.00, [28,27,25],  [237,234,227],[178,173,164],[158,154,146],[51,50,43],[18,19,26]],
  ];
  // 空のグロー（地平線の色味）stop: [t, r,g,b,a]
  const GLOW = [
    [0.00, 224,150,96, .22], [0.13, 246,224,178, .15], [0.38, 255,255,250, .05],
    [0.62, 240,166,112, .22],[0.80, 222,122,92, .24],  [0.90, 120,112,122, .12],
    [1.00, 70,84,116, .20],
  ];
  // 太陽/月 stop: [t, r,g,b, opacity, sizePx]
  const SUN = [
    [0.00, 226,150,96, .29, 196], [0.13, 247,216,158, .28, 200], [0.38, 252,250,246, .11, 220],
    [0.62, 243,176,116, .28, 206],[0.80, 227,138,98, .32, 192],  [0.90, 175,165,155, .07, 182],
    [0.96, 190,198,210, .36, 142],[1.00, 202,208,218, .46, 132],
  ];

  const lp = (a, b, k) => a + (b - a) * k;
  const lpRGB = (a, b, k) => [Math.round(lp(a[0],b[0],k)), Math.round(lp(a[1],b[1],k)), Math.round(lp(a[2],b[2],k))];
  function seg(stops, t, col) { // stops[i][0]=t。col=stops配列内の値の開始index
    let i = 0; for (; i < stops.length - 1; i++) { if (t <= stops[i + 1][0]) break; }
    const lo = stops[i], hi = stops[Math.min(i + 1, stops.length - 1)];
    const k = Math.min(1, Math.max(0, (t - lo[0]) / ((hi[0] - lo[0]) || 1)));
    return { lo, hi, k };
  }
  function palette(t) {
    const { lo, hi, k } = seg(STOPS, t);
    return { paper: lpRGB(lo[1],hi[1],k), ink: lpRGB(lo[2],hi[2],k), ink2: lpRGB(lo[3],hi[3],k),
             ink3: lpRGB(lo[4],hi[4],k), hair: lpRGB(lo[5],hi[5],k), sky: lpRGB(lo[6],hi[6],k) };
  }
  const rgb = (c) => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  const metaTheme = document.querySelector('meta[name="theme-color"]');

  let lastKey = '';
  function apply(t) {
    const key = t.toFixed(4);
    if (key === lastKey) return;
    lastKey = key;
    const p = palette(t);
    const S = root.style;
    S.setProperty('--t', key);
    S.setProperty('--paper', rgb(p.paper)); S.setProperty('--ink', rgb(p.ink));
    S.setProperty('--ink2', rgb(p.ink2)); S.setProperty('--ink3', rgb(p.ink3));
    S.setProperty('--hair', rgb(p.hair)); S.setProperty('--sky', rgb(p.sky));

    // 空のグロー
    const g = seg(GLOW, t);
    const gr = Math.round(lp(g.lo[1],g.hi[1],g.k)), gg = Math.round(lp(g.lo[2],g.hi[2],g.k)),
          gb = Math.round(lp(g.lo[3],g.hi[3],g.k)), ga = lp(g.lo[4],g.hi[4],g.k).toFixed(3);
    S.setProperty('--glow', `rgba(${gr},${gg},${gb},${ga})`);

    // 太陽/月：左→右に渡り、正午で高く、夕に低く沈み、夜は低い月
    const s = seg(SUN, t);
    const sr = Math.round(lp(s.lo[1],s.hi[1],s.k)), sg = Math.round(lp(s.lo[2],s.hi[2],s.k)),
          sb = Math.round(lp(s.lo[3],s.hi[3],s.k)), sop = lp(s.lo[4],s.hi[4],s.k),
          ssz = Math.round(lp(s.lo[5],s.hi[5],s.k));
    S.setProperty('--sun-color', `rgb(${sr},${sg},${sb})`);
    S.setProperty('--sun-op', sop.toFixed(3));
    S.setProperty('--sun-size', ssz + 'px');
    S.setProperty('--sun-x', (12 + 76 * t).toFixed(1) + '%');
    S.setProperty('--sun-top', (66 - 44 * Math.sin(Math.PI * Math.min(t, 1))).toFixed(1) + '%');

    const sk = window.__sky || (window.__sky = { paper: [246,245,242], ink: [28,27,25], breath: 1 });
    sk.paper = p.paper; sk.ink = p.ink;
    if (metaTheme) metaTheme.setAttribute('content', rgb(p.sky));
  }

  let docMax = 1;
  function measure() { docMax = Math.max(1, root.scrollHeight - innerHeight); }
  function progress() { return Math.min(1, Math.max(0, scrollY / docMax)); }
  measure();

  let onMeasure = function () {};
  addEventListener('resize', () => { measure(); onMeasure(); }, { passive: true });
  addEventListener('load', () => { measure(); onMeasure(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); onMeasure(); });

  if (reduce) {
    const onScroll = () => apply(progress());
    addEventListener('scroll', onScroll, { passive: true });
    onMeasure = onScroll;
    onScroll();
  } else {
    let cur = progress(), running = false;
    const tick = () => {
      const target = progress();
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
