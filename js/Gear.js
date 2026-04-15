/**
 * Gear — 歯車の物理・論理モジュール
 */
class Gear {
  constructor(index, totalCount) {
    this.index = index;
    this.totalCount = totalCount;

    this.angle = 0;
    this.angularVelocity = 0;
    this.rotationCount = 0;
  }

  getDisplayCount() {
    return this.rotationCount;
  }
}
