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
  assetLoader.load(); // 画像は先に。音声は AudioContext 作成後に reloadAudio

  // ─── モジュール ───
  const gears = [];
  for (let i = 0; i < GEAR_COUNT; i++) gears.push(new Gear(i, GEAR_COUNT));

  const timeCtrl         = new TimeController(GEAR_COUNT);
  const universeRenderer = new UniverseRenderer(universeCanvas);
  const gearRenderer     = new GearRenderer(gearCanvas, assetLoader);
  const counterRenderer  = new CounterRenderer(counterCanvas);
  const inputCtrl        = new InputController();
  const audioCtrl        = new AudioController(assetLoader);

  // 操作中は毎回 resume（decode 後に suspended に戻る端末対策）
  inputCtrl.onUserGesture = function() {
    audioCtrl.resumeIfNeeded();
  };

  // 音声はユーザージェスチャの同期スタックで AudioContext を起動しないと
  // suspended のまま無音になりやすい（従来は RAF 内 init だった）。
  (function bindAudioOnUserGesture() {
    let started = false;
    function prime() {
      if (started) return;
      started = true;
      audioCtrl.init().then(
        function() { audioInited = true; },
        function() { started = false; }
      );
    }
    ['pointerdown', 'touchstart', 'mousedown', 'wheel', 'keydown'].forEach(function(type) {
      window.addEventListener(type, prime, { capture: true, passive: true });
    });
  })();

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

  /** 右端の累積回転数（angle/(2π) に頼らない。角度が大きくなっても milestone / 表示が壊れない） */
  let totalRightSpins = 0;

  // ─── 状態 ───
  let frameCount  = 0;
  let audioInited = false; // bindAudioOnUserGesture / init 完了で true
  let firstInput  = false;

  // ─── メインループ ───
  function loop() {
    requestAnimationFrame(loop);
    try {
      frameCount++;

      // 入力（正方向のみ）
      let inputDelta = inputCtrl.consume();
      if (inputDelta < 0) inputDelta = 0;

      if (inputDelta > 0.0005 && !firstInput) {
        firstInput = true;
        hideTutorial();
      }

      // 右端に入力（係数が大きいほど同じ操作で速く回る）
      const INPUT_TO_VELOCITY = 0.36;
      velocities[GEAR_COUNT-1] += inputDelta * INPUT_TO_VELOCITY;
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
        if (!Number.isFinite(velocities[i]) || velocities[i] > 1e6 || velocities[i] < 0) velocities[i] = 0;
        if (!Number.isFinite(gears[i].angle)) gears[i].angle = 0;
      }

      // 右端の今フレーム回転量（tremor は右端では 0）
      const ri = GEAR_COUNT - 1;
      const tremorR = Math.sin(frameCount*0.038 + ri*1.9)
                    * (1 - ri/(GEAR_COUNT-1)) * 0.00006;
      const dThetaRight = velocities[ri] + tremorR;
      const TAU = Math.PI * 2;
      if (Number.isFinite(dThetaRight)) {
        totalRightSpins += dThetaRight / TAU;
      }
      if (!Number.isFinite(totalRightSpins) || totalRightSpins < 0) totalRightSpins = 0;

      // 角度が巨大になると float が破綻するので、右端だけ 2π の整数倍を削る（クリック差分は prev と同期）
      const MAX_A = 512 * TAU;
      if (gears[ri].angle > MAX_A) {
        const cut = Math.floor((gears[ri].angle - MAX_A / 2) / TAU) * TAU;
        gears[ri].angle -= cut;
        prevRightAngle -= cut;
      }

      // ─── カウント（累積回転は totalRightSpins を正とする） ───
      const rightRot = totalRightSpins;
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
    } catch (e) {
      console.error('[App] frame error', e);
    }
  }

  loop();
})();
