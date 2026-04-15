/**
 * AudioController — アセットファイル優先、Web Audio合成フォールバック
 *
 * AssetLoaderから受け取ったバッファがあればそれを使用。
 * null の場合は合成音で代替。
 * BGMはループ再生、SEはワンショット。
 */
class AudioController {
  constructor(assetLoader) {
    this.assets      = assetLoader; // AssetLoader
    this.ac          = null;
    this.master      = null;
    this.initialized = false;

    this._speed      = 0;
    this._phaseIdx   = 0;

    // BGM
    this._bgmSource  = null;
    this._bgmGain    = null;
    this._synthPads  = []; // 合成フォールバック用

    // 歯車ノイズ（合成）
    this._gearGain   = null;
    this._gearFilter = null;

    // 合成クリックバッファ（フォールバック）
    this._clickBuf   = null;

    // クリックの過剰連射防止
    this._lastClickTime = 0;

    this._bgmFileBuffer = null;
    this._pageAudioBound = false;
  }

  // ─────────────────────────── 初期化 ──────────────────────────

  /** マスター経由で無音を流し、モバイルで destination 直結より確実にアンロックする */
  _unlockThroughMaster() {
    if (!this.ac || !this.master) return;
    try {
      const ac = this.ac;
      const buf = ac.createBuffer(1, 1, ac.sampleRate);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const g = ac.createGain();
      g.gain.value = 0.0001;
      src.connect(g);
      g.connect(this.master);
      src.start();
    } catch (_) {
      // noop
    }
  }

  /** ジェスチャ後も suspended のままのことがある（decode 後など） */
  async resumeIfNeeded() {
    try {
      if (this.ac && this.ac.state === 'suspended') await this.ac.resume();
    } catch (_) {
      // noop
    }
  }

  async init() {
    if (this.initialized) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ac = new Ctx();
      if (this.ac.state === 'suspended') await this.ac.resume();

      this.master = this.ac.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ac.destination);

      this._unlockThroughMaster();

      // decode は非同期のため、ここで一度 suspended に戻ることがある
      await this.assets.reloadAudio(this.ac);
      await this.resumeIfNeeded();

      this._buildBGM();
      this._buildGearNoise();
      this._buildClickBuffer();

      await this.resumeIfNeeded();
      this.initialized = true;
      this._wirePageAudioResume();
    } catch(e) {
      console.warn('[AudioController] init error:', e);
      throw e;
    }
  }

  _wirePageAudioResume() {
    if (this._pageAudioBound) return;
    this._pageAudioBound = true;
    const kick = () => {
      this.resumeIfNeeded().then(() => {
        if (this._bgmFileBuffer && this.ac && this.ac.state === 'running') {
          this._startFileBGMLoop(true);
        }
      });
    };
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) kick();
    });
    window.addEventListener('pageshow', kick);
    window.addEventListener('focus', kick);
  }

  _stopBgmSource() {
    if (!this._bgmSource) return;
    try {
      this._bgmSource.stop(0);
    } catch (_) { /* already stopped */ }
    try {
      this._bgmSource.disconnect();
    } catch (_) { /* */ }
    this._bgmSource = null;
  }

  /** ファイルBGMを（再）開始。タブ復帰・suspend 復旧用 */
  _startFileBGMLoop(isResume) {
    if (!this.ac || !this._bgmGain || !this._bgmFileBuffer) return;
    this._stopBgmSource();
    const ac = this.ac;
    const src = ac.createBufferSource();
    src.buffer = this._bgmFileBuffer;
    src.loop = true;
    src.connect(this._bgmGain);
    this._bgmSource = src;
    src.onended = () => {
      if (this._bgmFileBuffer) this._startFileBGMLoop(true);
    };
    try {
      src.start(0);
    } catch (e) {
      console.warn('[AudioController] BGM start failed:', e);
      return;
    }
    const now = ac.currentTime;
    this._bgmGain.gain.cancelScheduledValues(now);
    if (isResume) {
      this._bgmGain.gain.setValueAtTime(1, now);
    } else {
      this._bgmGain.gain.setValueAtTime(0, now);
      this._bgmGain.gain.setTargetAtTime(1.0, now + 0.35, 1.8);
    }
  }

  // ─────────────────────────── BGM ─────────────────────────────

  _buildBGM() {
    const ac = this.ac;
    this._bgmGain = ac.createGain();
    this._bgmGain.gain.value = 0;
    this._bgmGain.connect(this.master);

    const bgmBuf = this.assets.getAudioBuffer('bgm');

    if (bgmBuf) {
      this._bgmFileBuffer = bgmBuf;
      this._startFileBGMLoop(false);

    } else {
      // ─── 合成パッドフォールバック ───
      const delay  = ac.createDelay(2.0);
      delay.delayTime.value = 0.36;
      const fb = ac.createGain(); fb.gain.value = 0.42;
      const dlf = ac.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = 700;
      delay.connect(dlf); dlf.connect(fb); fb.connect(delay); delay.connect(this._bgmGain);

      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -20; comp.ratio.value = 4;
      comp.connect(this._bgmGain);

      const base = 55;
      const cfg = [
        { r:1,    d:0,   t:'sine',     bg:0.055 },
        { r:1.25, d:4,   t:'triangle', bg:0.040 },
        { r:1.5,  d:-3,  t:'sine',     bg:0.035 },
        { r:2,    d:7,   t:'triangle', bg:0.025 },
        { r:3,    d:-5,  t:'sine',     bg:0.018 },
        { r:4,    d:2,   t:'triangle', bg:0.012 },
      ];
      this._synthPads = [];
      cfg.forEach((c, i) => {
        const osc = ac.createOscillator();
        osc.type = c.t; osc.frequency.value = base * c.r; osc.detune.value = c.d;
        const g = ac.createGain(); g.gain.value = 0;
        const lfo = ac.createOscillator(); lfo.frequency.value = 0.06 + i * 0.025;
        const lg  = ac.createGain(); lg.gain.value = 0.007;
        lfo.connect(lg); lg.connect(osc.frequency); lfo.start();
        osc.connect(g); g.connect(comp); g.connect(delay); osc.start();
        g.gain.setTargetAtTime(c.bg, ac.currentTime + i * 0.7, 1.0);
        this._synthPads.push({ g, base: c.bg });
      });
      this._bgmGain.gain.setTargetAtTime(1.0, ac.currentTime + 0.8, 1.5);
    }
  }

  // ─────────────────────────── 歯車ノイズ ──────────────────────

  _buildGearNoise() {
    const ac = this.ac;
    this._gearGain = ac.createGain(); this._gearGain.gain.value = 0;
    this._gearGain.connect(this.master);

    // ホワイトノイズバッファ
    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    const ns = ac.createBufferSource(); ns.buffer = buf; ns.loop = true;
    this._gearFilter = ac.createBiquadFilter();
    this._gearFilter.type = 'bandpass'; this._gearFilter.frequency.value = 600; this._gearFilter.Q.value = 2.5;
    const hpf = ac.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 250;
    ns.connect(this._gearFilter); this._gearFilter.connect(hpf); hpf.connect(this._gearGain);
    ns.start();
  }

  // ─────────────────────────── 合成クリック ────────────────────

  _buildClickBuffer() {
    const ac  = this.ac;
    const len = Math.floor(ac.sampleRate * 0.018);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = Math.sin(i * 0.9) * Math.exp(-i / len * 45) * (Math.random() * 0.3 + 0.7);
    }
    this._clickBuf = buf;
  }

  // ─────────────────────────── 毎フレーム ──────────────────────

  update(speed, phaseIdx) {
    if (!this.initialized) return;
    const ac  = this.ac;
    const now = ac.currentTime;
    this._speed    = speed;
    this._phaseIdx = phaseIdx;

    // 歯車ノイズ
    const gv = Math.min(0.5, speed * 10);
    this._gearGain.gain.setTargetAtTime(gv, now, 0.1);
    this._gearFilter.frequency.setTargetAtTime(Math.min(2800, 400 + speed * 2500), now, 0.12);

    // 合成パッドのフェーズ連動（ファイルBGM時は _synthPads が無い）
    const shift = phaseIdx * 0.04;
    if (this._synthPads && this._synthPads.length) {
      this._synthPads.forEach(p => {
        p.g.gain.setTargetAtTime(Math.min(0.16, p.base * (1 + shift)), now, 2.5);
      });
    }
  }

  // ─────────────────────────── ワンショット ────────────────────

  playClick(pitch = 1.0) {
    if (!this.initialized) return;
    const now = this.ac.currentTime;
    // 過剰連射防止（最小間隔20ms）
    if (now - this._lastClickTime < 0.02) return;
    this._lastClickTime = now;

    const fileBuf = this.assets.getAudioBuffer('se_gear_click');
    const buf = fileBuf || this._clickBuf;
    if (!buf) return;

    const src = this.ac.createBufferSource();
    src.buffer = buf;
    if (!fileBuf) src.playbackRate.value = 0.7 + pitch * 0.9;
    const g = this.ac.createGain(); g.gain.value = 0.22;
    src.connect(g); g.connect(this.master); src.start();
  }

  playShootingStar() {
    if (!this.initialized) return;
    const fileBuf = this.assets.getAudioBuffer('se_shooting_star');
    if (fileBuf) {
      this._playOnce(fileBuf, 0.35);
      return;
    }
    // 合成グリッサンド
    const ac = this.ac, now = ac.currentTime;
    const osc = ac.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(1600, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 1.1);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.15, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    osc.connect(g); g.connect(this.master);
    osc.start(now); osc.stop(now + 1.2);
  }

  playMilestoneChime(power = 3) {
    if (!this.initialized) return;
    const fileBuf = this.assets.getAudioBuffer('se_milestone');
    if (fileBuf) {
      this._playOnce(fileBuf, 0.55);
      return;
    }
    // 合成チャイム
    const ac = this.ac, now = ac.currentTime;
    const base = 880 * Math.pow(0.82, power - 3);
    [base, base*1.5, base*2, base*3].forEach((f, i) => {
      const osc = ac.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
      const g = ac.createGain();
      const t = now + i * 0.11;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.11 / (i+1), t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
      osc.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 2.5);
    });
  }

  playGoalFanfare() {
    if (!this.initialized) return;
    const fileBuf = this.assets.getAudioBuffer('se_goal');
    if (fileBuf) {
      this._playOnce(fileBuf, 0.7);
      return;
    }
    // 合成ファンファーレ（Aメジャーアルペジオ）
    const ac = this.ac, now = ac.currentTime;
    [220,277,330,440,554,660,880,1108].forEach((f, i) => {
      const o1 = ac.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
      const o2 = ac.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f*2;
      const g  = ac.createGain();
      const t  = now + i * 0.17;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
      o1.connect(g); o2.connect(g); g.connect(this.master);
      o1.start(t); o1.stop(t+3); o2.start(t); o2.stop(t+3);
    });
  }

  _playOnce(buf, vol = 0.5) {
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    const g = this.ac.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(this.master); src.start();
  }

  destroy() { if (this.ac) this.ac.close(); }
}
