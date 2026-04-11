/**
 * CounterRenderer — 歯車の回転カウンター表示
 * 「刻印」のような見た目を目指す
 */
class CounterRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * @param {Gear[]} gears
   * @param {Object[]} gearLayouts — GearRendererのlayouts
   */
  render(gears, gearLayouts) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = 0; i < gears.length; i++) {
      const gear = gears[i];
      const layout = gearLayouts[i];
      if (!layout) continue;

      const count = gear.getDisplayCount();
      const { x, y, r } = layout;

      // カウンター位置（歯車の上）
      const cx = x;
      const cy = y - r - 18;

      // 透明度（左ほど薄く）
      const tPos = i / (gears.length - 1); // 0=左, 1=右
      const alpha = 0.08 + tPos * 0.25;

      // 速度に応じた輝き
      const speed = Math.abs(gear.angularVelocity);
      const glow = Math.min(1, speed * 30);
      const finalAlpha = Math.min(0.9, alpha + glow * 0.6);

      // フォントサイズ（歯車サイズに比例）
      const fontSize = Math.max(8, Math.min(22, r * 0.3));

      ctx.save();
      ctx.font = `${fontSize}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 刻印感のあるシャドウ
      ctx.shadowColor = `rgba(180,140,60,${glow * 0.8})`;
      ctx.shadowBlur = 8 * glow;

      // テキスト
      ctx.fillStyle = `rgba(200,180,120,${finalAlpha})`;
      ctx.fillText(count.toString(), cx, cy);

      // 目盛り線（刻印感）
      ctx.strokeStyle = `rgba(180,160,100,${alpha * 0.5})`;
      ctx.lineWidth = 0.5;
      const tickW = fontSize * 0.8;
      ctx.beginPath();
      ctx.moveTo(cx - tickW, cy + fontSize * 0.7);
      ctx.lineTo(cx + tickW, cy + fontSize * 0.7);
      ctx.stroke();

      ctx.restore();
    }
  }
}
