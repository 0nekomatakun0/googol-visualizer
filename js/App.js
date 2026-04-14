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

  // ─── AssetLoader（最初に起動、音声はAC確定後に再ロード） ───
  const assetLoader = new AssetLoader();
  assetLoader.load(); // 画像だけ先にロード（音声はAC確定後）

  // ─── モジュール ───
  const gears = [];
  for (let i = 0; i < GEAR_COUNT; i++) gears.push(new Gear(i, GEAR_COUNT));

  const timeCtrl         = new TimeController(GEAR_COUNT);
  const universeRenderer = new UniverseRenderer(universeCanvas);
  const gearRenderer     = new GearRenderer(gearCanvas, assetLoader);
  const counterRenderer  = new CounterRenderer(counterCanvas);
  const inputCtrl        = new InputController();
  const audioCtrl        = new AudioController(assetLoader);

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

    const [r,g,b] = ms.color;
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
    }, 4200);
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
    universeRenderer.triggerMilestone({ color:[220,200,120], power:9 });
  }

  // ─── 流れ星スケジューラ ───
  let nextStarTime = Date.now() + 7000 + Math.random() * 10000;
  function schedStar() { nextStarTime = Date.now() + 5000 + Math.random() * 14000; }

  // ─── クリック音タイミング ───
  let prevRightAngle = 0;
  let clickAccum = 0;
  const CLICK_INTERVAL = (Math.PI * 2) / 16;

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

    if (inputDelta > 0.0005 && !firstInput) {
      firstInput = true;
      hideTutorial();
      audioCtrl.init().then(function() { audioInited = true; });
    }

    // 右端に入力
    velocities[GEAR_COUNT-1] += inputDelta * 0.7;
    if (velocities[GEAR_COUNT-1] < 0) velocities[GEAR_COUNT-1] = 0;

    // 右→左伝播
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

    // ─── カウント ───
    const rightRot = gears[GEAR_COUNT-1].angle / (Math.PI*2);
    for (let i = 0; i < GEAR_COUNT; i++) {
      gears[i].rotationCount = Math.floor(rightRot / Math.pow(10, GEAR_COUNT-1-i)) % 10;
    }

    // ─── TimeController ───
    const leftLogRad = (rightRot / Math.pow(10, GEAR_COUNT-1)) * (Math.PI*2);
    timeCtrl.update(rightRot, leftLogRad);

    // ─── 完走チェック ───
    if (!goalFired && rightRot >= Math.pow(10, GEAR_COUNT-1)) fireGoal();

    // ─── 流れ星 ───
    if (Date.now() >= nextStarTime) {
      universeRenderer.triggerShootingStar();
      if (audioInited) audioCtrl.playShootingStar();
      schedStar();
    }

    // ─── 歯車クリック音 ───
    if (audioInited) {
      const diff = gears[GEAR_COUNT-1].angle - prevRightAngle;
      clickAccum += diff;
      prevRightAngle = gears[GEAR_COUNT-1].angle;
      while (clickAccum >= CLICK_INTERVAL) {
        clickAccum -= CLICK_INTERVAL;
        audioCtrl.playClick(0.6 + velocities[GEAR_COUNT-1] * 8);
      }
    }

    // ─── 音声更新 ───
    if (audioInited) {
      audioCtrl.update(Math.abs(velocities[GEAR_COUNT-1]), timeCtrl.currentPhaseIndex);
    }

    // ─── 描画 ───
    universeRenderer.render(
      timeCtrl,
      velocities[GEAR_COUNT-1],
      rightRot,
      gearRenderer.contactPoints
    );
    gearRenderer.render(gears, frameCount, rightRot);
    counterRenderer.render(gears, gearRenderer.gearLayouts);
  }

  loop();
})();
