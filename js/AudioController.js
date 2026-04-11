/**
 * AudioController — Web Audio API による全サウンド管理
 *
 * 構成:
 *   BGM     : 複数オシレーターによるアンビエントパッド (Fm + detuned sines)
 *   歯車SE  : バンドパスフィルタ通したホワイトノイズ + クリック
 *   流れ星SE: 短いグリッサンド
 *   マイルストーンSE: 倍音チャイム
 *   完走チャイム: ゴールド和音
 */
class AudioController {
  constructor() {
    this.ac = null;
    this.master = null;
    this.initialized = false;

    // state
    this._speed = 0;
    this._phaseIndex = 0;

    // BGMノード群
    this._bgmGain = null;
    this._pads = [];

    // 歯車ノード群
    this._gearGain = null;
    this._noiseSource = null;
    this._gearFilter = null;

    // クリックバッファ（ワンショット）
    this._clickBuf = null;
  }

  // ──────────────────────────────────────────────────────────────
  //  初期化
  // ──────────────────────────────────────────────────────────────
  init() {
    if (this.initialized) return;
    try {
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      const ac = this.ac;

      this.master = ac.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(ac.destination);

      this._buildBGM();
      this._buildGearSound();
      this._buildClickBuffer();

      this.initialized = true;
    } catch(e) {
      console.warn('AudioContext error:', e);
    }
  }

  // ──────────────────────────────────────────────────────────────
  //  BGM — アンビエントパッド (detuned sines + LFO)
  // ──────────────────────────────────────────────────────────────
  _buildBGM() {
    const ac = this.ac;
    this._bgmGain = ac.createGain();
    this._bgmGain.gain.value = 0;  // 最初は無音→フェードイン
    this._bgmGain.connect(this.master);

    // リバーブ（畳み込み不使用、フィードバックディレイで代用）
    const delay = ac.createDelay(2.0);
    delay.delayTime.value = 0.38;
    const fbGain = ac.createGain();
    fbGain.gain.value = 0.45;
    const delayFilter = ac.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 800;
    delay.connect(delayFilter);
    delayFilter.connect(fbGain);
    fbGain.connect(delay);
    delay.connect(this._bgmGain);

    // コンプレッサー
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    comp.connect(this._bgmGain);

    // パッドオシレーター（ドローン和音）
    // 基音 A2=110Hz、和音：1, 5/4, 3/2, 2 (A,C#,E,A)
    const baseFreq = 55; // A1
    const ratios = [1, 1.25, 1.5, 2, 3, 4];
    const detunes = [0, 4, -3, 7, -5, 2];

    this._pads = [];
    for (let ri = 0; ri < ratios.length; ri++) {
      const osc = ac.createOscillator();
      osc.type = ri % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = baseFreq * ratios[ri];
      osc.detune.value = detunes[ri];

      const g = ac.createGain();
      g.gain.value = 0;

      // ゆらぎLFO
      const lfo = ac.createOscillator();
      lfo.frequency.value = 0.07 + ri * 0.03;
      const lfoG = ac.createGain();
      lfoG.gain.value = 0.008;
      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);
      lfo.start();

      osc.connect(g);
      g.connect(comp);
      g.connect(delay);
      osc.start();

      this._pads.push({ osc, g, baseGain: 0.06 + 0.04 / (ri + 1) });
    }

    // BGMフェードイン（3秒）
    this._bgmGain.gain.setTargetAtTime(1.0, ac.currentTime + 0.5, 1.5);

    // パッドを1本ずつ立ち上げる
    for (let i = 0; i < this._pads.length; i++) {
      const pad = this._pads[i];
      pad.g.gain.setTargetAtTime(pad.baseGain, ac.currentTime + i * 0.8, 1.2);
    }
  }

  // ──────────────────────────────────────────────────────────────
  //  歯車SE — バンドパスノイズ
  // ──────────────────────────────────────────────────────────────
  _buildGearSound() {
    const ac = this.ac;
    this._gearGain = ac.createGain();
    this._gearGain.gain.value = 0;
    this._gearGain.connect(this.master);

    // ホワイトノイズ
    const bufLen = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    this._noiseSource = ac.createBufferSource();
    this._noiseSource.buffer = buf;
    this._noiseSource.loop = true;

    // バンドパス（歯車の金属音帯域）
    this._gearFilter = ac.createBiquadFilter();
    this._gearFilter.type = 'bandpass';
    this._gearFilter.frequency.value = 800;
    this._gearFilter.Q.value = 3;

    // 高域カット
    const hpf = ac.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 300;

    this._noiseSource.connect(this._gearFilter);
    this._gearFilter.connect(hpf);
    hpf.connect(this._gearGain);
    this._noiseSource.start();
  }

  // ──────────────────────────────────────────────────────────────
  //  クリック音バッファ（歯車の刻み）
  // ──────────────────────────────────────────────────────────────
  _buildClickBuffer() {
    const ac = this.ac;
    const len = Math.floor(ac.sampleRate * 0.02);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      data[i] = Math.sin(i * 0.8) * Math.exp(-t * 40) * (Math.random()*0.3+0.7);
    }
    this._clickBuf = buf;
  }

  // ──────────────────────────────────────────────────────────────
  //  毎フレーム呼ぶ
  // ──────────────────────────────────────────────────────────────
  update(speed, phaseIndex) {
    if (!this.initialized) return;
    const ac = this.ac;
    const now = ac.currentTime;

    this._speed = speed;
    this._phaseIndex = phaseIndex;

    // 歯車ノイズ音量（速度に比例）
    const gearVol = Math.min(0.55, speed * 12);
    this._gearGain.gain.setTargetAtTime(gearVol, now, 0.08);

    // フィルター周波数（速く回るほど高域）
    const filterFreq = 400 + speed * 3000;
    this._gearFilter.frequency.setTargetAtTime(Math.min(3000, filterFreq), now, 0.1);

    // BGMパッドのフェーズ別音量・ピッチ変化
    const phaseShift = phaseIndex * 0.05;
    for (let i = 0; i < this._pads.length; i++) {
      const pad = this._pads[i];
      const targetGain = pad.baseGain * (1 + phaseShift);
      pad.g.gain.setTargetAtTime(Math.min(0.18, targetGain), now, 2.0);
    }
  }

  // ──────────────────────────────────────────────────────────────
  //  ワンショット系
  // ──────────────────────────────────────────────────────────────

  /** 歯車クリック音（歯が噛むたびに） */
  playClick(pitch = 1.0) {
    if (!this.initialized || !this._clickBuf) return;
    const ac = this.ac;
    const src = ac.createBufferSource();
    src.buffer = this._clickBuf;
    src.playbackRate.value = 0.8 + pitch * 0.8;
    const g = ac.createGain();
    g.gain.value = 0.25;
    src.connect(g);
    g.connect(this.master);
    src.start();
  }

  /** 流れ星SE — グリッサンド下降 */
  playShootingStar() {
    if (!this.initialized) return;
    const ac = this.ac;
    const now = ac.currentTime;

    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 1.2);

    const g = ac.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    // 軽いリバーブっぽく
    const delay = ac.createDelay();
    delay.delayTime.value = 0.12;
    const dfb = ac.createGain();
    dfb.gain.value = 0.3;
    delay.connect(dfb);
    dfb.connect(delay);
    delay.connect(g);

    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 1.3);
  }

  /** マイルストーンチャイム — 倍音重ね */
  playMilestoneChime(power = 3) {
    if (!this.initialized) return;
    const ac = this.ac;
    const now = ac.currentTime;

    // パワーに応じて音程変化（高→低）
    const baseFreq = 880 * Math.pow(0.85, power - 3);
    const freqs = [baseFreq, baseFreq * 1.5, baseFreq * 2, baseFreq * 3];

    for (let i = 0; i < freqs.length; i++) {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freqs[i];

      const g = ac.createGain();
      const startT = now + i * 0.12;
      g.gain.setValueAtTime(0, startT);
      g.gain.linearRampToValueAtTime(0.12 / (i + 1), startT + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, startT + 2.5);

      osc.connect(g);
      g.connect(this.master);
      osc.start(startT);
      osc.stop(startT + 2.6);
    }
  }

  /** 完走ゴールドチャイム */
  playGoalFanfare() {
    if (!this.initialized) return;
    const ac = this.ac;
    const now = ac.currentTime;

    // A major arpeggio: A C# E A C# E (上昇)
    const notes = [220, 277, 330, 440, 554, 660, 880, 1108];
    for (let i = 0; i < notes.length; i++) {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[i];

      const osc2 = ac.createOscillator(); // 倍音
      osc2.type = 'triangle';
      osc2.frequency.value = notes[i] * 2;

      const g = ac.createGain();
      const t = now + i * 0.18;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.15, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 3.0);

      osc.connect(g); osc2.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 3.1);
      osc2.start(t); osc2.stop(t + 3.1);
    }
  }

  destroy() {
    if (this.ac) this.ac.close();
  }
}
