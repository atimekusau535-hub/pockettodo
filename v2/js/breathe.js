/* breathe.js — 呼吸する背景（WebGL）
   紙の地にごく淡い墨のメッシュが、16秒周期でゆっくり膨らみ沈む。
   速さでなく"気配"。失敗・低性能・reduced-motion では静かに退場し #sky だけで成立する。 */
(function () {
  'use strict';

  const canvas = document.getElementById('breathe');
  if (!canvas) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 共有色（time.js が毎フレーム更新）。未起動でも紙色で成立。
  window.__sky = window.__sky || { paper: [246, 245, 242], ink: [28, 27, 25], breath: 1 };

  let gl;
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false, powerPreference: 'low-power' })
      || canvas.getContext('experimental-webgl');
  } catch (e) { gl = null; }

  function retire() {                       // WebGL退場 → CSS側(#sky)の呼吸へ委譲
    canvas.style.display = 'none';
    document.documentElement.classList.add('no-webgl');
  }
  if (!gl) { retire(); return; }            // CSS の #sky 呼吸だけで成立

  const VERT = `
    attribute vec2 p;
    void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

  // 値ノイズ + 2オクターブfbm + ドメインワープで有機的なメッシュ。
  // 出力は紙(u_paper)に墨(u_ink)をごく薄く(u_alpha)混ぜたもの。
  const FRAG = `
    precision mediump float;
    uniform vec2 u_res;
    uniform float u_time;
    uniform vec3 u_paper;
    uniform vec3 u_ink;
    uniform float u_alpha;

    float hash(vec2 n){ return fract(sin(dot(n, vec2(41.3, 289.1))) * 43758.5453); }
    float noise(vec2 x){
      vec2 i = floor(x); vec2 f = fract(x);
      vec2 u = f*f*(3.0-2.0*f);
      float a = hash(i), b = hash(i+vec2(1.0,0.0));
      float c = hash(i+vec2(0.0,1.0)), d = hash(i+vec2(1.0,1.0));
      return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
    }
    float fbm(vec2 p){
      float v = 0.0, a = 0.5;
      for(int i=0;i<3;i++){ v += a*noise(p); p *= 2.0; a *= 0.5; }
      return v;
    }
    void main(){
      vec2 uv = gl_FragCoord.xy / u_res;
      vec2 q = uv * 2.2;
      q.x *= u_res.x / u_res.y;
      float t = u_time * 0.018;                 // とても遅い
      // ドメインワープ：ノイズでノイズを歪ませる
      vec2 warp = vec2(fbm(q + vec2(t, 0.0)), fbm(q + vec2(0.0, t) + 5.2));
      float n = fbm(q + warp * 0.9 + t * 0.3);
      n = smoothstep(0.25, 0.95, n);
      // 中央ほど淡く、周縁にだけうっすら気配（ヴィネット反転）
      float vig = smoothstep(0.15, 1.1, distance(uv, vec2(0.5)));
      float ink = n * u_alpha * (0.55 + vig * 0.6);
      vec3 col = mix(u_paper/255.0, u_ink/255.0, ink);
      gl_FragColor = vec4(col, 1.0);
    }`;

  function sh(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { return null; }
    return s;
  }
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { retire(); return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { retire(); return; }
  gl.useProgram(prog);

  // フルスクリーン三角形
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {
    res: gl.getUniformLocation(prog, 'u_res'),
    time: gl.getUniformLocation(prog, 'u_time'),
    paper: gl.getUniformLocation(prog, 'u_paper'),
    ink: gl.getUniformLocation(prog, 'u_ink'),
    alpha: gl.getUniformLocation(prog, 'u_alpha'),
  };

  const SCALE = 0.62;                 // 内部解像度を落として軽量化（ぼかし前提）
  function resize() {
    const w = Math.max(2, Math.floor(innerWidth * SCALE));
    const h = Math.max(2, Math.floor(innerHeight * SCALE));
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  resize();
  let rzTimer = 0;
  addEventListener('resize', () => { clearTimeout(rzTimer); rzTimer = setTimeout(resize, 150); }, { passive: true });

  function draw(timeSec) {
    const sky = window.__sky || { paper: [246,245,242], ink: [28,27,25] };
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform1f(U.time, timeSec);
    gl.uniform3f(U.paper, sky.paper[0], sky.paper[1], sky.paper[2]);
    gl.uniform3f(U.ink, sky.ink[0], sky.ink[1], sky.ink[2]);
    gl.uniform1f(U.alpha, 0.06);       // 墨は最大6%。主張しない
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // reduced-motion：静止一枚だけ描いて退場
  if (reduce) { draw(2.0); return; }

  // ===== アニメーションループ（30fps上限・タブ非表示で停止・低fpsで退場） =====
  let running = true, last = 0;
  const FRAME = 1000 / 30;
  let probeFrames = 0, probeStart = 0, probeSlow = 0;
  const t0 = performance.now();

  function resetProbe() { probeFrames = 0; probeStart = 0; probeSlow = 0; }

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = now - last;
    // 復帰直後やタブ切替後の巨大dtスパイクは計測に混ぜず1フレーム捨てる
    if (dt > 1000) { last = now; resetProbe(); return; }
    if (dt < FRAME) return;
    last = now;

    // 起動/復帰直後1.6sのFPS監視：本当に遅いときだけ退場
    if (probeStart === 0) probeStart = now;
    if (now - probeStart < 1600) {
      probeFrames++;
      if (dt > 60) probeSlow++;
    } else if (probeFrames > 0) {
      const fps = probeFrames / ((now - probeStart) / 1000);
      const slow = probeSlow;
      resetProbe();
      if (fps < 20 || slow > 16) { running = false; retire(); return; }
    }
    draw((now - t0) / 1000);
  }
  requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { running = false; }
    else if (!running && canvas.style.display !== 'none') {
      running = true; last = 0; resetProbe(); requestAnimationFrame(loop);
    }
  });
})();
