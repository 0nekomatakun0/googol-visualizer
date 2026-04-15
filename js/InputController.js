/**
 * InputController — 操作管理
 *
 * PC   : マウスホイール（推奨）+ ドラッグ
 * スマホ: 縦スワイプ → 回転量に変換（角度計算ではなくY差分）
 *          上スワイプ = 正回転（直感的）
 *          フリック慣性あり
 */
class InputController {
  constructor() {
    this.deltaAngle      = 0;
    this.angularMomentum = 0;
    this.isDragging      = false;

    // PC ドラッグ（角度ベース）
    this.centerX  = 0;
    this.centerY  = 0;
    this.lastAngle = 0;

    // スマホ スワイプ（Y差分ベース）
    this._touchStartY  = 0;
    this._touchLastY   = 0;
    this._touchVY      = 0;  // Y速度（フリック慣性）
    this._touchStartX  = 0;
    this._touchLastX   = 0;

    // コールバック
    this.onMouseMove = null;
    /** タッチ/マウス/ホイールの同期ハンドラ内で呼ぶ（AudioContext.resume 用） */
    this.onUserGesture = null;

    this._bound = {
      mousedown:  this._onMouseDown.bind(this),
      mousemove:  this._onMouseMove.bind(this),
      mouseup:    this._onMouseUp.bind(this),
      touchstart: this._onTouchStart.bind(this),
      touchmove:  this._onTouchMove.bind(this),
      touchend:   this._onTouchEnd.bind(this),
      wheel:      this._onWheel.bind(this),
    };

    window.addEventListener('mousedown',  this._bound.mousedown);
    window.addEventListener('mousemove',  this._bound.mousemove);
    window.addEventListener('mouseup',    this._bound.mouseup);
    window.addEventListener('touchstart', this._bound.touchstart, { passive: false });
    window.addEventListener('touchmove',  this._bound.touchmove,  { passive: false });
    window.addEventListener('touchend',   this._bound.touchend);
    window.addEventListener('wheel',      this._bound.wheel, { passive: false });
  }

  setGearCenter(x, y) {
    this.centerX = x;
    this.centerY = y;
  }

  // ─────────────── PC マウス（ドラッグ） ────────────────────────

  _getAngle(x, y) {
    return Math.atan2(y - this.centerY, x - this.centerX);
  }

  _onMouseDown(e) {
    if (this.onUserGesture) this.onUserGesture(e);
    this.isDragging    = true;
    this.lastAngle     = this._getAngle(e.clientX, e.clientY);
    this.angularMomentum = 0;
    this.deltaAngle    = 0;
  }

  _onMouseMove(e) {
    if (this.onMouseMove) this.onMouseMove(e.clientX, e.clientY);
    if (!this.isDragging) return;
    const angle = this._getAngle(e.clientX, e.clientY);
    let delta = angle - this.lastAngle;
    if (delta >  Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    // 正方向のみ
    if (delta > 0) {
      this.deltaAngle      = delta;
      this.angularMomentum = delta * 0.45 + this.angularMomentum * 0.25;
    }
    this.lastAngle = angle;
  }

  _onMouseUp() {
    if (this.isDragging) {
      this.deltaAngle = Math.max(0, this.angularMomentum);
    }
    this.isDragging = false;
  }

  // ─────────────── スマホ タッチ（スワイプ） ───────────────────
  //
  // Y差分を回転量に変換する。
  // 画面高さに対してどれだけ動かしたか → 2π に対応させる。
  // → 画面を1本指で下→上にスワイプすると1回転する感覚。

_onTouchStart(e) {
  if (this.onUserGesture) this.onUserGesture(e);

  if (e.target.closest('#sound-choice') || e.target.closest('#mute-toggle')) {
    return;
  }

  e.preventDefault();

  const t = e.touches[0];
  this.isDragging      = true;
  this._touchLastY     = t.clientY;
  this._touchLastX     = t.clientX;
  this._touchStartY    = t.clientY;
  this._touchVY        = 0;
  this.angularMomentum = 0;
  this.deltaAngle      = 0;
}
    const t = e.touches[0];
    this.isDragging      = true;
    this._touchLastY     = t.clientY;
    this._touchLastX     = t.clientX;
    this._touchStartY    = t.clientY;
    this._touchVY        = 0;
    this.angularMomentum = 0;
    this.deltaAngle      = 0;
  }

_onTouchMove(e) {
  // 👇 これ追加（ボタン触ってるときは無視）
  if (e.target.closest('#sound-choice') || e.target.closest('#mute-toggle')) {
    return;
  }

  e.preventDefault();

  if (!this.isDragging || e.touches.length === 0) return;
    if (!this.isDragging || e.touches.length === 0) return;
    const t = e.touches[0];
    if (this.onMouseMove) this.onMouseMove(t.clientX, t.clientY);

    const dy = this._touchLastY - t.clientY; // 上方向が正
    const dx = this._touchLastX - t.clientX;

    // 縦スワイプが主か横スワイプが主かで感度を調整
    const isVertical = Math.abs(dy) >= Math.abs(dx) * 0.5;

    if (isVertical && dy > 0) { // 上スワイプ = 正回転のみ
      // 画面高さに対する1周分の感度（係数を大きくするほど同じスワイプで回転量が減る）
      const sensitivity = (Math.PI * 2) / (window.innerHeight * 2.1);
      const delta = dy * sensitivity;
      this.deltaAngle      = delta;
      this._touchVY        = dy * sensitivity * 0.7 + this._touchVY * 0.3;
      this.angularMomentum = this._touchVY;
    }

    this._touchLastY = t.clientY;
    this._touchLastX = t.clientX;
  }

  _onTouchEnd() {
    if (this.isDragging) {
      // フリック慣性：手を離した時の速度を残す
      this.deltaAngle = Math.max(0, this.angularMomentum * 0.6);
    }
    this.isDragging = false;
  }

  // ─────────────── ホイール ─────────────────────────────────────

  _onWheel(e) {
    if (this.onUserGesture) this.onUserGesture(e);
    e.preventDefault();
    const d = e.deltaY * 0.0028;
    if (d > 0) this.deltaAngle = d;
  }

  // ─────────────── consume ──────────────────────────────────────

  consume() {
    const d = this.deltaAngle;
    if (!this.isDragging) {
      // 慣性減衰（スワイプ後のフリック）
      this.deltaAngle *= 0.88;
      if (Math.abs(this.deltaAngle) < 0.0001) this.deltaAngle = 0;
    } else {
      this.deltaAngle = 0;
    }
    return d;
  }

  destroy() {
    window.removeEventListener('mousedown',  this._bound.mousedown);
    window.removeEventListener('mousemove',  this._bound.mousemove);
    window.removeEventListener('mouseup',    this._bound.mouseup);
    window.removeEventListener('touchstart', this._bound.touchstart);
    window.removeEventListener('touchmove',  this._bound.touchmove);
    window.removeEventListener('touchend',   this._bound.touchend);
    window.removeEventListener('wheel',      this._bound.wheel);
  }
}
