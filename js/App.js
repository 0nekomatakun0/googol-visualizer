/**
 * App.js — メインオーケストレーター
 */
(function () {
  const GEAR_COUNT = 10;

  // ─── DOM ───
  const universeCanvas = document.getElementById('universe-canvas');
  const gearCanvas     = document.getElementById('gear-canvas');
  const counterCanvas  = document.getElementById('counter-canvas');
  const cursor         = document.getElementById('cursor');
  const phaseLabel     = document.getElementById('phase-label');
  const tutorial       = document.getElementById('tutorial');
  const eventFlash     = document.getElementById('event-flash');
  const milestoneMsg   = document.getElementById('milestone-msg');

  // ─── モジュール ───
  const gears = [];
  for (let i = 0; i < GEAR_COUNT; i++) gears.push(new Gear(i, GEAR_COUNT));

  const timeCtrl        = new TimeController(GEAR_COUNT);
  const universeRenderer = new UniverseRenderer(universeCanvas);
  const gearRenderer    = new GearRenderer(gearCanvas);
  const counterRenderer = new CounterRenderer(counterCanvas);
  const inputCtrl       = new InputController();
  const audioCtrl       = new AudioController();

  // ─── 慣性係数 ───
  const INERTIA = [];
  for (let i = 0; i < GEAR_COUNT; i++) {
    const t = i / (GEAR_COUNT - 1); // 0=左,1=右
    INERTIA[i] = 0.988 - t * 0.065;
  }
  const velocities = new Float64Array(GEAR_COUNT);

  // ─── レイアウト ───
  function onResize() {
    universeRenderer.resize();
    gearRenderer.computeLayout(gears);
    counterRenderer.resize();
    const rl = gearRenderer.gearLayouts[GEAR_COUNT - 1];
    if (rl) inputCtrl.setGearCenter(rl.x, rl.y);
  }
  window.addEventListener('resize', onResize);
  onResize();

  // ─── フェーズラベル ───
  timeCtrl.onPhaseChange = function(name) {
    phaseLabel.textContent = '— ' + name + ' —';
    phaseLabel.style.opacity = '1';
    clearTimeout(phaseLabel._t);
    phaseLabel._t = setTimeout(function() { phaseLabel.style.opacity = '0.08'; }, 4000);
  };
  phaseLabel.style.opacity = '0.08';

  // ─── マイルストーン ───
  timeCtrl.onMilestone = function(ms) {
    // 宇宙背景演出
    universeRenderer.triggerMilestone(ms);

    // フラッシュ色
    const [r,g,b] = ms.color;
    eventFlash.style.background =
      `radial-gradient(ellipse at 50% 45%, rgba(${r},${g},${b},0.22) 0%, transparent 65%)`;
    eventFlash.classList.add('active');

    // テキスト
    milestoneMsg.querySelector('.title').textContent = ms.title;
    milestoneMsg.querySelector('.sub').textContent   = ms.sub;
    milestoneMsg.classList.add('active');

    clearTimeout(milestoneMsg._t);
    milestoneMsg._t = setTimeout(function() {
      eventFlash.classList.remove('active');
      milestoneMsg.classList.remove('active');
    }, 3500);
  };

  // ─── アンビエント変化 ───
  timeCtrl.onAmbient = function(phase) {
    universeRenderer.setAmbient(phase);
    // ambientBlendをUniverseRenderer内で管理するため、
    // timeCtrlのambientBlendを伝える
    timeCtrl.ambientBlend = 0;
  };

  // ─── カーソル ───
  inputCtrl.onMouseMove = function(x, y) {
    cursor.style.left = x + 'px';
    cursor.style.top  = y + 'px';
  };

  // ─── チュートリアル ───
  let tutorialDone = false;
  function hideTutorial() {
    if (tutorialDone) return;
    tutorialDone = true;
    tutorial.classList.add('fade-out');
    setTimeout(function() { tutorial.style.display = 'none'; }, 2600);
  }

  // ─── 状態 ───
  let frameCount  = 0;
  let audioInited = false;
  let firstInput  = false;

  // 累積回転数
  const totalRotations = new Float64Array(GEAR_COUNT);

  // ─── メインループ ───
  function loop() {
    requestAnimationFrame(loop);
    frameCount++;

    // 入力（正方向のみ）
    let inputDelta = inputCtrl.consume();
    if (inputDelta < 0) inputDelta = 0;

    if (inputDelta > 0.0005) {
      if (!firstInput) {
        firstInput = true;
        hideTutorial();
        audioCtrl.init();
        audioInited = true;
      }
    }

    // 右端に入力
    velocities[GEAR_COUNT-1] += inputDelta * 0.7;
    if (velocities[GEAR_COUNT-1] < 0) velocities[GEAR_COUNT-1] = 0;

    // 右→左伝播（10:1 慣性込み）
    for (let i = GEAR_COUNT-2; i >= 0; i--) {
      const target = velocities[i+1] * 0.1;
      const follow = 0.025 + (i / GEAR_COUNT) * 0.015;
      velocities[i] += (target - velocities[i]) * follow;
      if (velocities[i] < 0) velocities[i] = 0;
    }

    // 慣性減衰・角度更新
    for (let i = 0; i < GEAR_COUNT; i++) {
      velocities[i] *= INERTIA[i];
      const tremor = Math.sin(frameCount*0.038 + i*1.9)
                   * (1 - i/(GEAR_COUNT-1)) * 0.00006;
      gears[i].angularVelocity = velocities[i];
      gears[i].angle += velocities[i] + tremor;
    }

    // ─── カウント計算（右端基準の連鎖） ───
    // 右端の累積回転数
    const rightRot = gears[GEAR_COUNT-1].angle / (Math.PI*2);
    for (let i = 0; i < GEAR_COUNT; i++) {
      const power = GEAR_COUNT-1-i; // 右端からの距離
      const logRot = rightRot / Math.pow(10, power);
      gears[i].rotationCount = Math.floor(logRot) % 10;
    }

    // ─── TimeController更新 ───
    const rightFullRot  = gears[GEAR_COUNT-1].angle / (Math.PI*2);
    const leftLogicalRad = rightFullRot / Math.pow(10, GEAR_COUNT-1) * (Math.PI*2);
    timeCtrl.update(rightFullRot, leftLogicalRad);

    // アンビエントブレンド
    if (timeCtrl.ambientBlend !== undefined) {
      timeCtrl.ambientBlend += 0.005;
      if (timeCtrl.ambientBlend > 1) timeCtrl.ambientBlend = 1;
    }

    // 音声
    if (audioInited) {
      audioCtrl.update(Math.abs(velocities[GEAR_COUNT-1]), timeCtrl.currentPhaseIndex);
    }

    // ─── 描画 ───
    universeRenderer.render(timeCtrl, velocities[GEAR_COUNT-1]);
    gearRenderer.render(gears, frameCount, timeCtrl);
    counterRenderer.render(gears, gearRenderer.gearLayouts);
  }

  loop();
})();
