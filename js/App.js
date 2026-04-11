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
  const goalScreen     = document.getElementById('goal-screen');

  // ─── モジュール ───
  const gears = [];
  for (let i = 0; i < GEAR_COUNT; i++) gears.push(new Gear(i, GEAR_COUNT));

  const timeCtrl         = new TimeController(GEAR_COUNT);
  const universeRenderer = new UniverseRenderer(universeCanvas);
  const gearRenderer     = new GearRenderer(gearCanvas);
  const counterRenderer  = new CounterRenderer(counterCanvas);
  const inputCtrl        = new InputController();
  const audioCtrl        = new AudioController();

  // ─── 慣性係数 ───
  const INERTIA = [];
  for (let i = 0; i < GEAR_COUNT; i++) {
    INERTIA[i] = 0.988 - (i / (GEAR_COUNT - 1)) * 0.065;
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
  phaseLabel.style.opacity = '0';
  timeCtrl.onPhaseChange = function(name) {
    phaseLabel.textContent = '— ' + name + ' —';
    phaseLabel.style.opacity = '1';
    clearTimeout(phaseLabel._t);
    phaseLabel._t = setTimeout(function() { phaseLabel.style.opacity = '0'; }, 4500);
  };

  // ─── マイルストーン ───
  timeCtrl.onMilestone = function(ms) {
    universeRenderer.triggerMilestone(ms);
    audioCtrl.playMilestoneChime(ms.power);

    const [r, g, b] = ms.color;
    eventFlash.style.background =
      `radial-gradient(ellipse at 50% 45%, rgba(${r},${g},${b},0.25) 0%, transparent 65%)`;
    eventFlash.classList.add('active');

    milestoneMsg.querySelector('.title').textContent = ms.title;
    milestoneMsg.querySelector('.sub').textContent   = ms.sub;
    milestoneMsg.classList.add('active');

    clearTimeout(milestoneMsg._t);
    milestoneMsg._t = setTimeout(function() {
      eventFlash.classList.remove('active');
      milestoneMsg.classList.remove('active');
    }, 4000);
  };

  // ─── アンビエント ───
  timeCtrl.onAmbient = function(phase) {
    universeRenderer.setAmbient(phase);
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
    setTimeout(function() { tutorial.style.display = 'none'; }, 2700);
  }

  // ─── 完走 ───
  let goalFired = false;
  function fireGoal() {
    if (goalFired) return;
    goalFired = true;
    goalScreen.classList.add('active');
    audioCtrl.playGoalFanfare();
    universeRenderer.triggerMilestone({ color: [220, 200, 120], power: 9 });
  }

  // ─── 流れ星スケジューラ ───
  let nextShootingStarTime = Date.now() + 6000 + Math.random() * 8000;

  function scheduleShootingStar() {
    nextShootingStarTime = Date.now() + 5000 + Math.random() * 12000;
  }

  // ─── 歯車クリック音のタイミング管理 ───
  // 右端歯車が1歯分回るたびにクリック
  let prevRightAngle = 0;
  let clickAccum = 0;
  const TEETH = 16; // 右端の歯数（GearRenderer依存しない近似値）
  const CLICK_INTERVAL = (Math.PI * 2) / TEETH;

  // ─── 状態 ───
  let frameCount  = 0;
  let audioInited = false;
  let firstInput  = false;

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
    velocities[GEAR_COUNT - 1] += inputDelta * 0.7;
    if (velocities[GEAR_COUNT - 1] < 0) velocities[GEAR_COUNT - 1] = 0;

    // 右→左伝播
    for (let i = GEAR_COUNT - 2; i >= 0; i--) {
      const target = velocities[i + 1] * 0.1;
      const follow = 0.025 + (i / GEAR_COUNT) * 0.015;
      velocities[i] += (target - velocities[i]) * follow;
      if (velocities[i] < 0) velocities[i] = 0;
    }

    // 慣性減衰・角度更新
    for (let i = 0; i < GEAR_COUNT; i++) {
      velocities[i] *= INERTIA[i];
      const tremor = Math.sin(frameCount * 0.038 + i * 1.9)
                   * (1 - i / (GEAR_COUNT - 1)) * 0.00006;
      gears[i].angularVelocity = velocities[i];
      gears[i].angle += velocities[i] + tremor;
    }

    // ─── カウント（右端基準の連鎖） ───
    const rightRot = gears[GEAR_COUNT - 1].angle / (Math.PI * 2);
    for (let i = 0; i < GEAR_COUNT; i++) {
      const power = GEAR_COUNT - 1 - i;
      gears[i].rotationCount = Math.floor(rightRot / Math.pow(10, power)) % 10;
    }

    // ─── TimeController ───
    const leftLogicalRad = (rightRot / Math.pow(10, GEAR_COUNT - 1)) * (Math.PI * 2);
    timeCtrl.update(rightRot, leftLogicalRad);

    // ─── 完走チェック（左端が1周） ───
    if (!goalFired && gears[0].rotationCount >= 1 && rightRot >= Math.pow(10, GEAR_COUNT - 1)) {
      fireGoal();
    }

    // ─── 流れ星 ───
    if (Date.now() >= nextShootingStarTime) {
      universeRenderer.triggerShootingStar();
      if (audioInited) audioCtrl.playShootingStar();
      scheduleShootingStar();
    }

    // ─── 歯車クリック音 ───
    if (audioInited) {
      const rightGearAngle = gears[GEAR_COUNT - 1].angle;
      const angleDiff = rightGearAngle - prevRightAngle;
      clickAccum += angleDiff;
      prevRightAngle = rightGearAngle;
      while (clickAccum >= CLICK_INTERVAL) {
        clickAccum -= CLICK_INTERVAL;
        const pitch = 0.6 + velocities[GEAR_COUNT - 1] * 8;
        audioCtrl.playClick(pitch);
      }
    }

    // ─── 音声更新 ───
    if (audioInited) {
      audioCtrl.update(Math.abs(velocities[GEAR_COUNT - 1]), timeCtrl.currentPhaseIndex);
    }

    // ─── 描画 ───
    universeRenderer.render(timeCtrl, velocities[GEAR_COUNT - 1]);
    gearRenderer.render(gears, frameCount, timeCtrl);
    counterRenderer.render(gears, gearRenderer.gearLayouts);
  }

  loop();
})();
