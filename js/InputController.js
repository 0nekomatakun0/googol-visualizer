/**
 * InputController — ユーザー操作の管理
 * 右端歯車をドラッグで回転させる
 */
class InputController {
  constructor() {
    this.isDragging = false;
    this.lastAngle = 0;        // 最後のマウス角度
    this.lastX = 0;
    this.lastY = 0;
    this.deltaAngle = 0;       // 現フレームの角度変化
    this.angularMomentum = 0;  // ドラッグ速度（慣性付与用）
    this.centerX = 0;
    this.centerY = 0;

    // カーソル更新コールバック
    this.onMouseMove = null;

    this._bound = {
      mousedown: this._onMouseDown.bind(this),
      mousemove: this._onMouseMove.bind(this),
      mouseup: this._onMouseUp.bind(this),
      touchstart: this._onTouchStart.bind(this),
      touchmove: this._onTouchMove.bind(this),
      touchend: this._onTouchEnd.bind(this),
      wheel: this._onWheel.bind(this),
    };

    window.addEventListener('mousedown', this._bound.mousedown);
    window.addEventListener('mousemove', this._bound.mousemove);
    window.addEventListener('mouseup', this._bound.mouseup);
    window.addEventListener('touchstart', this._bound.touchstart, { passive: false });
    window.addEventListener('touchmove', this._bound.touchmove, { passive: false });
    window.addEventListener('touchend', this._bound.touchend);
    window.addEventListener('wheel', this._bound.wheel, { passive: false });
  }

  /**
   * 右端歯車の中心座標をセット
   */
  setGearCenter(x, y) {
    this.centerX = x;
    this.centerY = y;
  }

  _getAngle(x, y) {
    return Math.atan2(y - this.centerY, x - this.centerX);
  }

  _onMouseDown(e) {
    this.isDragging = true;
    this.lastAngle = this._getAngle(e.clientX, e.clientY);
    this.angularMomentum = 0;
    this.deltaAngle = 0;
  }

  _onMouseMove(e) {
    if (this.onMouseMove) this.onMouseMove(e.clientX, e.clientY);
    if (!this.isDragging) return;

    const angle = this._getAngle(e.clientX, e.clientY);
    let delta = angle - this.lastAngle;

    // 角度の折り返し対策
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;

    this.deltaAngle = delta;
    this.angularMomentum = delta * 0.8 + this.angularMomentum * 0.2;
    this.lastAngle = angle;
  }

  _onMouseUp(e) {
    if (this.isDragging) {
      // ドラッグ終了時に慣性を残す
      this.deltaAngle = this.angularMomentum;
    }
    this.isDragging = false;
  }

  _onTouchStart(e) {
    e.preventDefault();
    const t = e.touches[0];
    this.isDragging = true;
    this.lastAngle = this._getAngle(t.clientX, t.clientY);
    this.angularMomentum = 0;
    this.deltaAngle = 0;
  }

  _onTouchMove(e) {
    e.preventDefault();
    if (!this.isDragging) return;
    const t = e.touches[0];
    if (this.onMouseMove) this.onMouseMove(t.clientX, t.clientY);

    const angle = this._getAngle(t.clientX, t.clientY);
    let delta = angle - this.lastAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;

    this.deltaAngle = delta;
    this.angularMomentum = delta * 0.8 + this.angularMomentum * 0.2;
    this.lastAngle = angle;
  }

  _onTouchEnd(e) {
    if (this.isDragging) {
      this.deltaAngle = this.angularMomentum;
    }
    this.isDragging = false;
  }

  _onWheel(e) {
    e.preventDefault();
    // 正方向のみ（逆回転無効）
    const d = e.deltaY * 0.004;
    if (d > 0) this.deltaAngle = d;
  }

  /**
   * フレームごとに呼ぶ
   * @returns {number} 右端歯車に加える角速度の変化量
   */
  consume() {
    const d = this.deltaAngle;
    if (!this.isDragging) {
      this.deltaAngle *= 0.85; // ホイールの慣性
    } else {
      this.deltaAngle = 0; // ドラッグ中は消費して次のmousemoveを待つ
    }
    return d;
  }

  destroy() {
    window.removeEventListener('mousedown', this._bound.mousedown);
    window.removeEventListener('mousemove', this._bound.mousemove);
    window.removeEventListener('mouseup', this._bound.mouseup);
    window.removeEventListener('touchstart', this._bound.touchstart);
    window.removeEventListener('touchmove', this._bound.touchmove);
    window.removeEventListener('touchend', this._bound.touchend);
    window.removeEventListener('wheel', this._bound.wheel);
  }
}
