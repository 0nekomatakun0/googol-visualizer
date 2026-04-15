/**
 * CounterRenderer — 歯車の回転カウンター表示
 */
class CounterRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  resize() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (typeof setupCanvas2D === 'function') {
      const out = setupCanvas2D(this.canvas, W, H);
      this.ctx = out.ctx;
      this._cssW = out.cssW;
      this._cssH = out.cssH;
    } else {
      this.canvas.width = W;
      this.canvas.height = H;
      this._cssW = W;
      this._cssH = H;
    }
  }

  render(gears, gearLayouts) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const cssW = typeof this._cssW === 'number' ? this._cssW : W;
    const cssH = typeof this._cssH === 'number' ? this._cssH : H;
    ctx.clearRect(0, 0, cssW, cssH);

    for (let i = 0; i < gears.length; i++) {
      const gear   = gears[i];
      const layout = gearLayouts[i];
      if (!layout) continue;

      const count = typeof gear.getDisplayCount === 'function'
        ? gear.getDisplayCount()
        : gear.rotationCount;
      const { x, y, r } = layout;
      const cx = x;
      const cy = y - r - 22;

      const tPos     = i / (gears.length - 1);
      const speed    = Math.abs(gear.angularVelocity);
      const isActive = speed > 0.0001 || count > 0;

      const fontSize = Math.max(10, Math.min(26, r * 0.38));
      const padW = fontSize * 1.1;
      const padH = fontSize * 1.4;

      ctx.save();

      const plateAlpha = 0.72 + tPos * 0.18;
      ctx.fillStyle = `rgba(0,0,0,${plateAlpha})`;
      this._roundRect(ctx, cx - padW, cy - padH * 0.55, padW * 2, padH, 3);
      ctx.fill();

      const borderAlpha = isActive ? 0.55 + speed * 8 : 0.18;
      ctx.strokeStyle = isActive
        ? `rgba(200,170,80,${Math.min(0.9, borderAlpha)})`
        : `rgba(120,100,60,0.2)`;
      ctx.lineWidth = 0.8;
      this._roundRect(ctx, cx - padW, cy - padH * 0.55, padW * 2, padH, 3);
      ctx.stroke();

      ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      if (speed > 0.0003) {
        ctx.shadowColor = `rgba(220,190,100,${Math.min(0.8, speed * 25)})`;
        ctx.shadowBlur  = Math.min(12, speed * 200);
      }

      const textAlpha = isActive ? 0.95 : 0.35 + tPos * 0.25;
      ctx.fillStyle = count > 0
        ? `rgba(240,220,150,${textAlpha})`
        : `rgba(160,150,130,${textAlpha * 0.6})`;

      ctx.fillText(String(count), cx, cy);

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
