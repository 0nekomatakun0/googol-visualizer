/**
 * GearRenderer — 歯車の描画モジュール
 */
class GearRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gearLayouts = []; // 各歯車の描画パラメータ
  }

  /**
   * 歯車レイアウトを計算（resize時に呼ぶ）
   * @param {Gear[]} gears
   */
  computeLayout(gears) {
    const W = this.canvas.width = window.innerWidth;
    const H = this.canvas.height = window.innerHeight;
    const N = gears.length;

    // 左ほど大きく、右ほど小さく
    // 最大半径 / 最小半径
    const maxR = Math.min(H * 0.28, W / (N * 1.2));
    const minR = maxR * 0.28;

    this.gearLayouts = [];

    // まずサイズ計算
    const radii = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1); // 0=左, 1=右
      const r = maxR * (1 - t) + minR * t;
      radii.push(r);
    }

    // X位置（重なりを持たせる）
    // 右から詰めて並べる
    const positions = new Array(N);
    let x = W - radii[N-1] - 20;
    positions[N-1] = x;
    for (let i = N - 2; i >= 0; i--) {
      x -= (radii[i] + radii[i+1]) * 0.88; // 少し重なる
      positions[i] = x;
    }

    // Y位置（下辺に歯車の下端を揃える）
    const baseY = H;
    for (let i = 0; i < N; i++) {
      this.gearLayouts.push({
        x: positions[i],
        y: baseY - radii[i] * 0.15, // 少し下に埋まる
        r: radii[i],
        teethCount: Math.max(8, Math.floor(radii[i] / 6)),
      });
    }
  }

  /**
   * @param {Gear[]} gears
   * @param {number} time — フレームカウント（光エフェクト用）
   * @param {TimeController} timeCtrl
   */
  render(gears, time, timeCtrl) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // クリア（透明）
    ctx.clearRect(0, 0, W, H);

    const normTime = timeCtrl.getNormalizedTime();

    for (let i = 0; i < gears.length; i++) {
      const gear = gears[i];
      const layout = this.gearLayouts[i];
      if (!layout) continue;

      const isRightmost = (i === gears.length - 1);
      this._drawGear(ctx, gear, layout, time, normTime, isRightmost, i, gears.length);
    }
  }

  _drawGear(ctx, gear, layout, time, normTime, isRightmost, index, total) {
    const { x, y, r, teethCount } = layout;
    const angle = gear.angle;

    // 歯車の素材感：左ほど古い金属（暗い）、右ほど新しい（明るめ）
    const t = index / (total - 1); // 0=左, 1=右
    const brightness = 0.3 + t * 0.4;
    const speed = Math.abs(gear.angularVelocity);

    // 回転速度に応じた光の変化
    const glow = Math.min(1, speed * 40);

    ctx.save();
    ctx.translate(x, y);

    // ─── グロー（動きがある時）───
    if (glow > 0.01) {
      const glowGrad = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.6);
      const glowColor = isRightmost
        ? `rgba(180,140,80,${glow * 0.15})`
        : `rgba(100,120,180,${glow * 0.08})`;
      glowGrad.addColorStop(0, glowColor);
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 微細な揺れ光（左の歯車は常にごく微かに光る）
    const trembleGlow = (1 - t) * (0.02 + 0.01 * Math.sin(time * 0.03 + index));
    if (trembleGlow > 0.005) {
      const tGlowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.2);
      tGlowGrad.addColorStop(0, `rgba(80,100,160,${trembleGlow})`);
      tGlowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = tGlowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // ─── 歯車本体描画 ───
    ctx.rotate(angle);
    this._drawGearShape(ctx, r, teethCount, brightness, t, glow, isRightmost, time);

    ctx.restore();
  }

  _drawGearShape(ctx, r, teethCount, brightness, tPos, glow, isRightmost, time) {
    const toothHeight = r * 0.18;
    const toothWidth = (Math.PI * 2) / teethCount;
    const innerR = r * 0.82;
    const hubR = r * 0.18;

    // 金属グラデーション
    const metalGrad = ctx.createRadialGradient(-r*0.2, -r*0.2, r*0.1, 0, 0, r);
    const b = brightness;
    metalGrad.addColorStop(0, `rgba(${Math.round(220*b+glow*40)},${Math.round(200*b+glow*30)},${Math.round(160*b)},0.95)`);
    metalGrad.addColorStop(0.4, `rgba(${Math.round(140*b)},${Math.round(130*b)},${Math.round(110*b)},0.95)`);
    metalGrad.addColorStop(1, `rgba(${Math.round(60*b)},${Math.round(55*b)},${Math.round(50*b)},0.95)`);

    // ─── 歯の描画 ───
    ctx.beginPath();
    for (let i = 0; i < teethCount; i++) {
      const a0 = i * toothWidth;
      const a1 = a0 + toothWidth * 0.35;
      const a2 = a0 + toothWidth * 0.5;
      const a3 = a0 + toothWidth * 0.65;
      const a4 = a0 + toothWidth;

      if (i === 0) {
        ctx.moveTo(innerR * Math.cos(a0), innerR * Math.sin(a0));
      }
      ctx.lineTo(innerR * Math.cos(a0), innerR * Math.sin(a0));
      ctx.lineTo((r + toothHeight) * Math.cos(a1), (r + toothHeight) * Math.sin(a1));
      ctx.lineTo((r + toothHeight) * Math.cos(a2), (r + toothHeight) * Math.sin(a2));
      ctx.lineTo((r + toothHeight) * Math.cos(a3), (r + toothHeight) * Math.sin(a3));
      ctx.lineTo(innerR * Math.cos(a4), innerR * Math.sin(a4));
    }
    ctx.closePath();
    ctx.fillStyle = metalGrad;
    ctx.fill();

    // エッジ
    ctx.strokeStyle = `rgba(${Math.round(255*brightness+glow*60)},${Math.round(240*brightness)},${Math.round(200*brightness)},0.4)`;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // ─── 内円 ───
    ctx.beginPath();
    ctx.arc(0, 0, innerR, 0, Math.PI * 2);
    const innerGrad = ctx.createRadialGradient(-innerR*0.2, -innerR*0.2, innerR*0.1, 0, 0, innerR);
    innerGrad.addColorStop(0, `rgba(${Math.round(100*brightness)},${Math.round(90*brightness)},${Math.round(70*brightness)},1)`);
    innerGrad.addColorStop(1, `rgba(${Math.round(30*brightness)},${Math.round(28*brightness)},${Math.round(22*brightness)},1)`);
    ctx.fillStyle = innerGrad;
    ctx.fill();
    ctx.strokeStyle = `rgba(180,160,120,${0.15 + brightness * 0.1})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // ─── スポーク ───
    const spokeCount = Math.min(6, Math.max(4, Math.floor(teethCount / 6)));
    for (let i = 0; i < spokeCount; i++) {
      const sa = (i / spokeCount) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(hubR * Math.cos(sa), hubR * Math.sin(sa));
      ctx.lineTo(innerR * 0.85 * Math.cos(sa), innerR * 0.85 * Math.sin(sa));
      ctx.strokeStyle = `rgba(${Math.round(160*brightness)},${Math.round(140*brightness)},${Math.round(110*brightness)},0.6)`;
      ctx.lineWidth = r * 0.04;
      ctx.stroke();
    }

    // ─── ハブ ───
    ctx.beginPath();
    ctx.arc(0, 0, hubR, 0, Math.PI * 2);
    const hubGrad = ctx.createRadialGradient(-hubR*0.3, -hubR*0.3, 1, 0, 0, hubR);
    hubGrad.addColorStop(0, `rgba(${Math.round(200*brightness+glow*50)},${Math.round(180*brightness+glow*40)},${Math.round(140*brightness)},1)`);
    hubGrad.addColorStop(1, `rgba(${Math.round(60*brightness)},${Math.round(55*brightness)},${Math.round(40*brightness)},1)`);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = `rgba(255,240,200,${0.3 + glow * 0.4})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // ─── 操作可能な右端歯車のインジケーター ───
    if (isRightmost) {
      ctx.beginPath();
      ctx.arc(0, 0, hubR * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,200,100,${0.6 + glow * 0.4})`;
      ctx.fill();
    }
  }
}
