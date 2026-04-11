/**
 * TimeController
 *
 * マイルストーン設計:
 *   右端から数えて4番目(index 6)のカウントが1になる = 右端が10^3 = 1000周
 *   右端から数えて5番目(index 5)のカウントが1        = 10^4周
 *   ...
 *   右端から数えて10番目(index 0, 左端)が1           = 10^9周
 *
 * ユーザーが言う「4個目の歯車が1」= 右から4番目 = index(GEAR_COUNT-4) = index 6
 *   右端累積回転数 >= 10^3  → milestone[0]
 *   右端累積回転数 >= 10^4  → milestone[1]
 *   ...
 *   右端累積回転数 >= 10^9  → milestone[6] (最終)
 *
 * ambient変化は経過実時間で発生
 */
class TimeController {
  constructor(gearCount) {
    this.gearCount = gearCount; // 10

    // ─── 歯車マイルストーン ───
    // 「右から4番目の歯車(index6)が初めて1になる」= 右端が1000周
    // 「右から5番目(index5)が1になる」= 10000周 … 「左端(index0)が1になる」= 10^9周
    this.milestones = [
      { power: 3,  title: 'なにかが動いた',        sub: 'something stirs',          color: [180,140,80]  },
      { power: 4,  title: '時間の流れが変わる',    sub: 'time shifts',              color: [80,120,220]  },
      { power: 5,  title: '光が生まれた',          sub: 'light is born',            color: [220,200,100] },
      { power: 6,  title: '星々が輝く',            sub: 'stars ignite',             color: [100,160,255] },
      { power: 7,  title: '銀河が渦を巻く',        sub: 'galaxies spiral',          color: [60,80,200]   },
      { power: 8,  title: '世界が形成される',      sub: 'a world takes shape',      color: [40,120,80]   },
      { power: 9,  title: '時間の果てに',          sub: 'at the edge of time',      color: [20,20,20]    },
    ];
    this.firedMilestones = new Set();
    this.onMilestone = null; // callback(milestoneObj)

    // ─── アンビエント変化 ───
    // 実時間（秒）で発生
    this.startTime = Date.now();
    this.ambientPhase = 0; // 0=normal 1=dusk 2=night 3=rain 4=aurora ...
    this.ambientTimer = 0;
    this.onAmbient = null; // callback(phase)

    // アンビエントスケジュール（秒）
    this.ambientSchedule = [
      { at: 40,  phase: 1 }, // 黄昏
      { at: 90,  phase: 2 }, // 深夜
      { at: 150, phase: 3 }, // 雨
      { at: 220, phase: 4 }, // オーロラ
      { at: 300, phase: 5 }, // 夜明け
    ];
    this.firedAmbient = new Set();

    // ─── 宇宙フェーズ（左端論理回転量ベース） ───
    this.cosmicTime = 0;
    this.currentPhaseIndex = 0;
    this.phaseProgress = 0;
    this.onPhaseChange = null;

    this.phases = [
      { name: 'BEFORE TIME',  threshold: 0    },
      { name: 'FIRST LIGHT',  threshold: 0.05 },
      { name: 'STARS BORN',   threshold: 0.3  },
      { name: 'GALAXIES',     threshold: 1.0  },
      { name: 'SOLAR SYSTEM', threshold: 3.0  },
      { name: 'EARTH',        threshold: 6.0  },
      { name: 'LIFE',         threshold: 10.0 },
      { name: 'HUMANITY',     threshold: 15.0 },
    ];
  }

  /**
   * @param {number} rightGearTotalRot  右端の累積回転数（整数部）
   * @param {number} leftGearAbsRad     左端の累積ラジアン（宇宙時間用）
   */
  update(rightGearTotalRot, leftGearAbsRad) {
    // ─── マイルストーン判定 ───
    for (const ms of this.milestones) {
      const threshold = Math.pow(10, ms.power);
      if (!this.firedMilestones.has(ms.power) && rightGearTotalRot >= threshold) {
        this.firedMilestones.add(ms.power);
        if (this.onMilestone) this.onMilestone(ms);
      }
    }

    // ─── アンビエント判定（経過秒） ───
    const elapsed = (Date.now() - this.startTime) / 1000;
    for (const sched of this.ambientSchedule) {
      if (!this.firedAmbient.has(sched.at) && elapsed >= sched.at) {
        this.firedAmbient.add(sched.at);
        this.ambientPhase = sched.phase;
        if (this.onAmbient) this.onAmbient(sched.phase);
      }
    }
    this.ambientTimer = elapsed;

    // ─── 宇宙フェーズ ───
    this.cosmicTime = leftGearAbsRad;
    let newPhaseIndex = 0;
    for (let i = this.phases.length - 1; i >= 0; i--) {
      if (this.cosmicTime >= this.phases[i].threshold) { newPhaseIndex = i; break; }
    }
    if (newPhaseIndex !== this.currentPhaseIndex) {
      this.currentPhaseIndex = newPhaseIndex;
      if (this.onPhaseChange) this.onPhaseChange(this.phases[newPhaseIndex].name);
    }
    const cur = this.phases[this.currentPhaseIndex];
    const nxt = this.phases[this.currentPhaseIndex + 1];
    this.phaseProgress = nxt
      ? Math.min(1, (this.cosmicTime - cur.threshold) / (nxt.threshold - cur.threshold))
      : 1;
  }

  getNormalizedTime() {
    const max = this.phases[this.phases.length - 1].threshold;
    return Math.min(1, this.cosmicTime / max);
  }

  getCurrentPhase() { return this.phases[this.currentPhaseIndex]; }
}
