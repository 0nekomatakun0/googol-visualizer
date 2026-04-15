/**
 * GearRenderer — 歯車描画
 * - AssetLoader経由でgear_textureが渡されれば overlay合成
 * - 接触点パーティクルの座標を外部に公開（contactPoints[]）
 * - 累積エネルギーに応じて発光（rotationEnergyベース）
 */
class GearRenderer {
  constructor(canvas, assetLoader) {
    this.canvas     = canvas;
    this.ctx        = canvas.getContext('2d');
    this.assets     = assetLoader;
    this.gearLayouts = [];

    // 外部から読める接触点リスト（毎フレーム更新）
    // [{ x, y, energy }]
    this.contactPoints = [];
  }

  computeLayout(gears) {
    const W = this.canvas.width  = window.innerWidth;
    const H = this.canvas.height = window.innerHeight;
    const N = gears.length;

    const maxR = Math.min(H * 0.28, W / (N * 1.2));
    const minR = maxR * 0.28;
    const radii = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      radii.push(maxR * (1 - t) + minR * t);
    }

    const positions = new Array(N);
    let x = W - radii[N-1] - 20;
    positions[N-1] = x;
    for (let i = N-2; i >= 0; i--) {
      x -= (radii[i] + radii[i+1]) * 0.88;
      positions[i] = x;
    }

    this.gearLayouts = [];
    for (let i = 0; i < N; i++) {
      this.gearLayouts.push({
        x: positions[i],
        y: H - radii[i] * 0.15,
        r: radii[i],
        teethCount: Math.max(8, Math.floor(radii[i] / 6)),
      });
    }
  }

  render(gears, time, totalRightRot) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 接触点をリセット
    this.contactPoints = [];

    const texture = this.assets ? this.assets.getImage('gear_texture') : null;

    for (let i = 0; i < gears.length; i++) {
      const gear   = gears[i];
      const layout = this.gearLayouts[i];
      if (!layout) continue;

      const isRight = (i === gears.length - 1);
      const t       = i / (gears.length - 1); // 0=左,1=右

      // 累積エネルギー = 右端の回転数 / 10^(右からの距離)
      const power       = gears.length - 1 - i;
      const logRot      = totalRightRot / Math.pow(10, power);
      const energy      = Math.min(1, (logRot % 1)); // フラクション部分 0→1

      this._drawGear(ctx, gear, layout, time, t, isRight, energy, texture);

      // 接触点（隣の歯車との接点）
      if (i < gears.length - 1) {
        const nextLayout = this.gearLayouts[i + 1];
        if (nextLayout) {
          const dx  = nextLayout.x - layout.x;
          const dy  = nextLayout.y - layout.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          const cx  = layout.x + (dx / dist) * layout.r;
          const cy  = layout.y + (dy / dist) * layout.r;
          const spd = Math.abs(gear.angularVelocity);
          if (spd > 0.00005) {
            this.contactPoints.push({ x: cx, y: cy, energy: Math.min(1, spd * 60) });
          }
        }
      }
    }
  }

  _drawGear(ctx, gear, layout, time, tPos, isRightmost, energy, texture) {
    const { x, y, r, teethCount } = layout;
    const brightness = 0.28 + tPos * 0.42;
    const speed      = Math.abs(gear.angularVelocity);
    const glow       = Math.min(1, speed * 35);

    ctx.save();
    ctx.translate(x, y);

    // ─── 外部グロー（速度 + 累積エネルギー） ───
    const glowIntensity = Math.max(glow, energy * 0.3);
    if (glowIntensity > 0.008) {
      const glowR  = isRightmost ? `180,140,80` : `90,110,200`;
      const grad   = ctx.createRadialGradient(0,0,r*0.5, 0,0,r*1.8);
      grad.addColorStop(0, `rgba(${glowR},${glowIntensity * 0.18})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(0,0,r*1.8,0,Math.PI*2); ctx.fill();
    }

    // ─── 微細揺れグロー（左ほど常時） ───
    const tg = (1-tPos) * (0.018 + 0.01 * Math.sin(time*0.03+tPos*10));
    if (tg > 0.004) {
      const tgg = ctx.createRadialGradient(0,0,0,0,0,r*1.15);
      tgg.addColorStop(0,`rgba(70,90,180,${tg})`); tgg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = tgg; ctx.beginPath(); ctx.arc(0,0,r*1.15,0,Math.PI*2); ctx.fill();
    }

    // ─── 本体 ───
    ctx.rotate(gear.angle);
    this._drawGearShape(ctx, r, teethCount, brightness, tPos, glow, energy, isRightmost, texture);
    ctx.restore();
  }

  _drawGearShape(ctx, r, teethCount, brightness, tPos, glow, energy, isRightmost, texture) {
    const th  = r * 0.18;
    const tw  = (Math.PI*2) / teethCount;
    const iR  = r * 0.82;
    const hR  = r * 0.18;
    const b   = brightness;

    const drawGearPath = () => {
      ctx.beginPath();
      for (let i = 0; i < teethCount; i++) {
        const a0=i*tw, a1=a0+tw*0.35, a2=a0+tw*0.5, a3=a0+tw*0.65, a4=a0+tw;
        if(i===0) ctx.moveTo(iR*Math.cos(a0), iR*Math.sin(a0));
        ctx.lineTo(iR*Math.cos(a0), iR*Math.sin(a0));
        ctx.lineTo((r+th)*Math.cos(a1),(r+th)*Math.sin(a1));
        ctx.lineTo((r+th)*Math.cos(a2),(r+th)*Math.sin(a2));
        ctx.lineTo((r+th)*Math.cos(a3),(r+th)*Math.sin(a3));
        ctx.lineTo(iR*Math.cos(a4), iR*Math.sin(a4));
      }
      ctx.closePath();
    };

    // 画像がある場合は「画像そのものをそのまま表示」する
    if (texture) {
      ctx.drawImage(texture, -r, -r, r*2, r*2);
      // 画像表示時は金属の内円/スポーク/ハブを重ねない。
      return;
    } else {
      // 金属グラデ
      const mg = ctx.createRadialGradient(-r*0.2,-r*0.2,r*0.1, 0,0,r);
      mg.addColorStop(0,`rgba(${(220*b+glow*35+energy*20)|0},${(200*b+glow*25)|0},${(160*b)|0},0.95)`);
      mg.addColorStop(0.4,`rgba(${(140*b)|0},${(130*b)|0},${(110*b)|0},0.95)`);
      mg.addColorStop(1,`rgba(${(60*b)|0},${(55*b)|0},${(50*b)|0},0.95)`);

      // 歯
      drawGearPath();
      ctx.fillStyle = mg; ctx.fill();
      ctx.strokeStyle=`rgba(${(255*b+glow*55)|0},${(240*b)|0},${(200*b)|0},0.38)`;
      ctx.lineWidth=0.8; ctx.stroke();
    }

    // 内円
    ctx.beginPath(); ctx.arc(0,0,iR,0,Math.PI*2);
    const ig=ctx.createRadialGradient(-iR*0.2,-iR*0.2,iR*0.1,0,0,iR);
    ig.addColorStop(0,`rgba(${(100*b)|0},${(90*b)|0},${(70*b)|0},1)`);
    ig.addColorStop(1,`rgba(${(28*b)|0},${(25*b)|0},${(20*b)|0},1)`);
    ctx.fillStyle=ig; ctx.fill();
    ctx.strokeStyle=`rgba(180,160,120,${0.12+b*0.1})`; ctx.lineWidth=1; ctx.stroke();

    // スポーク
    const sc=Math.min(6,Math.max(4,Math.floor(teethCount/6)));
    for(let i=0;i<sc;i++){
      const sa=(i/sc)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(hR*Math.cos(sa),hR*Math.sin(sa));
      ctx.lineTo(iR*0.85*Math.cos(sa),iR*0.85*Math.sin(sa));
      ctx.strokeStyle=`rgba(${(160*b)|0},${(140*b)|0},${(110*b)|0},0.55)`;
      ctx.lineWidth=r*0.04; ctx.stroke();
    }

    // ハブ
    ctx.beginPath(); ctx.arc(0,0,hR,0,Math.PI*2);
    const hg=ctx.createRadialGradient(-hR*0.3,-hR*0.3,1,0,0,hR);
    hg.addColorStop(0,`rgba(${(200*b+glow*45+energy*30)|0},${(180*b+glow*35)|0},${(140*b)|0},1)`);
    hg.addColorStop(1,`rgba(${(58*b)|0},${(52*b)|0},${(38*b)|0},1)`);
    ctx.fillStyle=hg; ctx.fill();
    ctx.strokeStyle=`rgba(255,240,200,${0.28+glow*0.42+energy*0.2})`; ctx.lineWidth=0.8; ctx.stroke();

    // 右端インジケーター（エネルギー発光）
    if (isRightmost) {
      ctx.beginPath(); ctx.arc(0,0,hR*0.42,0,Math.PI*2);
      ctx.fillStyle=`rgba(255,${(190+energy*60)|0},${(80+energy*40)|0},${0.55+glow*0.45})`;
      ctx.fill();
    }
  }
}
