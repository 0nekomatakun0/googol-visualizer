/**
 * AudioController — 歯車音・宇宙音の簡易実装
 * Web Audio API使用
 */
class AudioController {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.gearOscillator = null;
    this.gearGain = null;
    this.cosmicDrone = null;
    this.cosmicGain = null;
    this.initialized = false;
    this.currentSpeed = 0;
    this.currentPhase = 0;
  }

  /**
   * ユーザー操作後に初期化（AudioContext制限対策）
   */
  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.15;
      this.masterGain.connect(this.ctx.destination);

      // ─── 歯車音（高周波ノイズ） ───
      this.gearGain = this.ctx.createGain();
      this.gearGain.gain.value = 0;
      this.gearGain.connect(this.masterGain);

      const bufferSize = 2048;
      this.gearNode = this.ctx.createScriptProcessor(bufferSize, 1, 1);
      this._noisePhase = 0;
      this.gearNode.onaudioprocess = (e) => {
        const out = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          // バンドパス的な金属音
          out[i] = (Math.random() * 2 - 1) * 0.3
                 + Math.sin(this._noisePhase) * 0.7;
          this._noisePhase += 0.08 + this.currentSpeed * 0.5;
        }
      };
      this.gearNode.connect(this.gearGain);

      // ─── 宇宙ドローン ───
      this.cosmicGain = this.ctx.createGain();
      this.cosmicGain.gain.value = 0;
      this.cosmicGain.connect(this.masterGain);

      this.cosmicOsc = this.ctx.createOscillator();
      this.cosmicOsc.type = 'sine';
      this.cosmicOsc.frequency.value = 40;
      this.cosmicOsc.start();

      this.cosmicFilter = this.ctx.createBiquadFilter();
      this.cosmicFilter.type = 'lowpass';
      this.cosmicFilter.frequency.value = 200;

      this.cosmicOsc.connect(this.cosmicFilter);
      this.cosmicFilter.connect(this.cosmicGain);

      this.initialized = true;
    } catch(e) {
      console.warn('AudioContext not available:', e);
    }
  }

  /**
   * @param {number} speed — 右端歯車の角速度（絶対値）
   * @param {number} phaseIndex — 宇宙フェーズ
   */
  update(speed, phaseIndex) {
    if (!this.initialized) return;
    this.currentSpeed = speed;
    this.currentPhase = phaseIndex;

    const now = this.ctx.currentTime;
    const targetGearGain = Math.min(0.8, speed * 15);
    const targetDroneGain = 0.05 + phaseIndex * 0.04;

    this.gearGain.gain.setTargetAtTime(targetGearGain, now, 0.1);
    this.cosmicGain.gain.setTargetAtTime(Math.min(0.5, targetDroneGain), now, 1.0);

    // フェーズに応じてドローンの音程変化
    const targetFreq = 30 + phaseIndex * 8;
    this.cosmicOsc.frequency.setTargetAtTime(targetFreq, now, 2.0);
  }

  destroy() {
    if (this.ctx) this.ctx.close();
  }
}
