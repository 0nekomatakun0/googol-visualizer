/**
 * Gear — 歯車の物理・論理モジュール
 */
class Gear {
  constructor(index, totalCount) {
    this.index = index;       // 0 = 左端（最も遅い）
    this.totalCount = totalCount;

    this.angle = 0;           // 累積回転角（ラジアン、正方向のみ）
    this.angularVelocity = 0;
    this.rotationCount = 0;   // 0〜9 のカウント表示用

    // 表示カウント計算用：累積完全回転数（整数）
    this._totalFullRotations = 0;
  }

  getDisplayCount() {
    return this.rotationCount;
  }
}
