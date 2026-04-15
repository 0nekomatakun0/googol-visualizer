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
  const muteToggle     = document.getElementById('mute-toggle');
  const iconSound      = document.getElementById('icon-sound');
  const iconMuted      = document.getElementById('icon-muted');
  const btnSoundOn     = document.getElementById('btn-sound-on');
  const btnSoundOff    = document.getElementById('btn-sound-off');

  // ─── AssetLoader ───
  const assetLoader = new AssetLoader();
  assetLoader.load();

  // ─── モジュール ───
  const gears = [];
  for (let i = 0; i < GEAR_COUNT; i++) gears.push(new Gear(i, GEAR_COUNT));

  const timeCtrl         = new TimeController(GEAR_COUNT);
  const universeRenderer = new UniverseRenderer(universeCanvas);
  const gearRenderer     = new GearRenderer(gearCanvas, assetLoader);
  const counterRenderer  = new CounterRenderer(counterCanvas);
  const inputCtrl        = new InputController();
  const audioCtrl        = new AudioController(assetLoader);

  inputCtrl.onUserGesture = function() { audioCtrl.resumeIfNeeded(); };

  // ─── ミュートアイコン同期 ───
  function syncMuteIcon() {
    const m = audioCtrl.isMuted();
    iconSound.style.display = m ? 'none'  : '';
    iconMuted.style.display = m ? ''      : 'none';
    muteToggle.title = m ? '音をオンにする' : 'ミュート';
  }

  muteToggle.addEventListener('click', function(e) {
    e.stopPropagation();
    audioCtrl.setMuted(!audioCtrl.isMuted());
    syncMuteIcon();
  });

  // ─── チュートリアルのボタン処理 ───
  // 音あり／消音どちらを選んでも始まる。
  // ボタンはユーザージェスチャなので AudioContext を安全に起動できる。
  let audioStarted = false;

  function startWithSound(muted) {
    if (audioStarted) return;
    audioStarted = true;

    // ミュート状態を先にセット
    audioCtrl.setMuted(muted);
    syncMuteIcon();

    // ジェスチャスタックの同期部分でACを生成
    try {
      audioCtrl.beginSyncFromGesture();
    } catch(e) {
      console.warn('[Audio] beginSync failed', e);
    }

    // 非同期初期化
    audioCtrl.finishInitAsync().then(
      function() { audioInited = true; syncMuteIcon(); },
      function(e) { console.warn('[Audio] init failed', e); }
    );

    // チュートリアルを閉じる
    hideTutorial();

    // ミュートアイコンをフェードイン
    setTimeout(function() { muteToggle.classList.add('visible'); }, 2800);
  }

  function addSoundBtn(el, muted) {
    el.addEventListener('click', function(e) { e.stopPropagation(); startWithSound(muted); });
    el.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); startWithSound(muted); });
  }
  addSoundBtn(btnSoundOn,  false);
  addSoundBtn(btnSoundOff, true);

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
    setTimeout(function() { tutorial.style.display = 'none'; }, 2400);
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
  let totalRightSpins = 0;

  // ─── 状態 ───
  let frameCount  = 0;
  let audioInited = false;

  // ─── メインループ ───
  function loop() {
    requestAnimationFrame(loop);
    try {
      frameCount++;

      let inputDelta = inputCtrl.consume();
      if (inputDelta < 0) inputDelta = 0;

      // 右端に入力
      velocities[GEAR_COUNT-1] += inputDelta * 0.36;
      if (velocities[GEAR_COUNT-1] < 0) velocities[GEAR_COUNT-1] = 0;

      // 右→左伝播
      for (let i = GEAR_COUNT-2; i >= 0; i--) {
        const target = velocities[i+1] * 0.1;
        const follow = 0.025 + (i / GEAR_COUNT) * 0.015;
        velocities[i] += (target - velocities[i]) * follow;
        if (velocities[i] < 0) velocities[i] = 0;
      }

      // 慣性減衰・角度更新
      const TAU = Math.PI * 2;
      for (let i = 0; i < GEAR_COUNT; i++) {
        velocities[i] *= INERTIA[i];
        const tremor = Math.sin(frameCount*0.038 + i*1.9)
                     * (1 - i/(GEAR_COUNT-1)) * 0.00006;
        gears[i].angularVelocity = velocities[i];
        gears[i].angle += velocities[i] + tremor;
        if (!Number.isFinite(velocities[i]) || velocities[i] > 1e6) velocities[i] = 0;
        if (!Number.isFinite(gears[i].angle)) gears[i].angle = 0;
      }

      // 右端の累積スピン
      const ri = GEAR_COUNT - 1;
      const dTheta = velocities[ri];
      if (Number.isFinite(dTheta)) totalRightSpins += dTheta / TAU;
      if (!Number.isFinite(totalRightSpins) || totalRightSpins < 0) totalRightSpins = 0;

      // 角度オーバーフロー防止
      const MAX_A = 512 * TAU;
      if (gears[ri].angle > MAX_A) {
        const cut = Math.floor((gears[ri].angle - MAX_A / 2) / TAU) * TAU;
        gears[ri].angle  -= cut;
        prevRightAngle   -= cut;
      }

      // カウント
      const rightRot = totalRightSpins;
      for (let i = 0; i < GEAR_COUNT; i++) {
        gears[i].rotationCount = Math.floor(rightRot / Math.pow(10, GEAR_COUNT-1-i)) % 10;
      }

      // TimeController
      const leftLogRad = (rightRot / Math.pow(10, GEAR_COUNT-1)) * TAU;
      timeCtrl.update(rightRot, leftLogRad);

      // 完走
      if (!goalFired && rightRot >= Math.pow(10, GEAR_COUNT-1)) fireGoal();

      // 流れ星
      if (Date.now() >= nextStarTime) {
        universeRenderer.triggerShootingStar();
        if (audioInited) audioCtrl.playShootingStar();
        schedStar();
      }

      // 歯車クリック音
      if (audioInited) {
        const diff = gears[ri].angle - prevRightAngle;
        clickAccum    += diff;
        prevRightAngle = gears[ri].angle;
        while (clickAccum >= CLICK_INTERVAL) {
          clickAccum -= CLICK_INTERVAL;
          audioCtrl.playClick(0.6 + velocities[ri] * 8);
        }
        audioCtrl.update(Math.abs(velocities[ri]), timeCtrl.currentPhaseIndex);
      }

      // 描画
      universeRenderer.render(timeCtrl, velocities[ri], rightRot, gearRenderer.contactPoints);
      gearRenderer.render(gears, frameCount, rightRot);
      counterRenderer.render(gears, gearRenderer.gearLayouts);

    } catch(e) {
      console.error('[App] frame error', e);
    }
  }

  loop();
})();
