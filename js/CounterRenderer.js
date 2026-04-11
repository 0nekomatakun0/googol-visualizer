/**
 * CounterRenderer — 歯車の回転カウンター表示
 * 視認性重視。背景ブラックプレートに白字+金縁。
 */
class CounterRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  render(gears, gearLayouts) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = 0; i < gears.length; i++) {
      const gear   = gears[i];
      const layout = gearLayouts[i];
      if (!layout) continue;

      const count = gear.getDisplayCount();
      const { x, y, r } = layout;
      const cx = x;
      const cy = y - r - 22;

      const tPos     = i / (gears.length - 1); // 0=左,1=右
      const speed    = Math.abs(gear.angularVelocity);
      const isActive = speed > 0.0001 || count > 0;

      // フォントサイズ
      const fontSize = Math.max(10, Math.min(26, r * 0.38));
      const padW = fontSize * 1.1;
      const padH = fontSize * 1.4;

      ctx.save();

      // ── 背景プレート（常に表示、視認性確保）──
      const plateAlpha = 0.72 + tPos * 0.18;
      ctx.fillStyle = `rgba(0,0,0,${plateAlpha})`;
      this._roundRect(ctx, cx - padW, cy - padH * 0.55, padW * 2, padH, 3);
      ctx.fill();

      // プレート縁（アクティブ時は金色）
      const borderAlpha = isActive ? 0.55 + speed * 8 : 0.18;
      ctx.strokeStyle = isActive
        ? `rgba(200,170,80,${Math.min(0.9, borderAlpha)})`
        : `rgba(120,100,60,0.2)`;
      ctx.lineWidth = 0.8;
      this._roundRect(ctx, cx - padW, cy - padH * 0.55, padW * 2, padH, 3);
      ctx.stroke();

      // ── 数字 ──
      ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      // グロー（回転中）
      if (speed > 0.0003) {
        ctx.shadowColor = `rgba(220,190,100,${Math.min(0.8, speed * 25)})`;
        ctx.shadowBlur  = Math.min(12, speed * 200);
      }

      // 数字色：アクティブ=明るいクリーム、静止=薄いグレー
      const textAlpha = isActive ? 0.95 : 0.35 + tPos * 0.25;
      ctx.fillStyle = count > 0
        ? `rgba(240,220,150,${textAlpha})`
        : `rgba(160,150,130,${textAlpha * 0.6})`;

      ctx.fillText(count.toString(), cx, cy);

      ctx.restore();
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
