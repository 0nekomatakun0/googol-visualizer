/**
 * UniverseRenderer — 宇宙背景の描画
 *
 * ambientPhase:
 *   0 = 通常宇宙
 *   1 = 黄昏（オレンジ〜赤）
 *   2 = 深夜（深い青）
 *   3 = 雨
 *   4 = オーロラ
 *   5 = 夜明け
 *
 * マイルストーン演出: triggerMilestone(ms) で呼ぶ
 */
class UniverseRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();

    this.time = 0;
    this.lastPhaseIndex = -1;

    // 星・パーティクル・星雲
    this.stars = [];
    this.particles = [];
    this.nebulae = [];
    this.events = [];

    // アンビエント
    this.ambientPhase = 0;
    this.ambientBlend = 0;   // 0→1 トランジション進行度
    this.ambientTarget = 0;

    // 雨
    this.rainDrops = [];

    // オーロラ
    this.auroraWaves = [];

    // マイルストーン
    this.milestoneQueue = []; // { timer, color, rings }

    // 流れ星
    this.shootingStars = [];

    this._initStars();
    this._initParticles();
    this._initNebulae();
    this._initAurora();
  }

  resize() {
    this.W = this.canvas.width  = window.innerWidth;
    this.H = this.canvas.height = window.innerHeight;
  }

  // ─────────────────────────── init ────────────────────────────

  _initStars() {
    this.stars = [];
    for (let i = 0; i < 700; i++) {
      this.stars.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H,
        r: Math.random() * 1.6 + 0.2,
        brightness: Math.random(),
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.008 + Math.random() * 0.025,
        born: Math.random() * 15,
        type: Math.floor(Math.random() * 3), // 0=白,1=青,2=橙
      });
    }
  }

  _initParticles() {
    this.particles = [];
    for (let i = 0; i < 150; i++) this._spawnParticle(true);
  }

  _initNebulae() {
    this.nebulae = [];
    for (let i = 0; i < 5; i++) {
      this.nebulae.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H * 0.75,
        rx: 100 + Math.random() * 220,
        ry: 50 + Math.random() * 130,
        hue: Math.random() * 360,
        alpha: 0,
        targetAlpha: 0.05 + Math.random() * 0.09,
        rotation: Math.random() * Math.PI,
      });
    }
  }

  _initAurora() {
    this.auroraWaves = [];
    for (let i = 0; i < 5; i++) {
      this.auroraWaves.push({
        phase: Math.random() * Math.PI * 2,
        speed: 0.005 + Math.random() * 0.008,
        hue: 120 + Math.random() * 140,
        yBase: 0.15 + Math.random() * 0.3,
        amp: 0.04 + Math.random() * 0.08,
      });
    }
  }

  // ─────────────────────────── public API ────────────────────────

  triggerShootingStar() {
    const W = this.W, H = this.H;
    const angle = (Math.random() * 0.4 + 0.1) * Math.PI; // 斜め下方向
    const speed = 8 + Math.random() * 12;
    this.shootingStars.push({
      x: Math.random() * W * 0.8 + W * 0.1,
      y: Math.random() * H * 0.35,
      vx:  Math.cos(angle) * speed,
      vy:  Math.sin(angle) * speed,
      len: 60 + Math.random() * 120,
      life: 1,
      decay: 0.022 + Math.random() * 0.015,
    });
  }

  setAmbient(phase) {
    this.ambientTarget = phase;
    this.ambientBlend  = 0;
  }

  triggerStarBirth() {
    this.events.push({
      x: Math.random() * this.W,
      y: Math.random() * this.H * 0.8,
      life: 1, r: 1,
      maxR: 30 + Math.random() * 70,
    });
  }

  /**
   * マイルストーン演出
   * @param {{ color: number[], power: number }} ms
   */
  triggerMilestone(ms) {
    const [cr, cg, cb] = ms.color;
    // 複数リング
    const rings = [];
    for (let i = 0; i < 3; i++) {
      rings.push({ delay: i * 25, born: false });
    }
    this.milestoneQueue.push({
      timer: 240,
      color: `${cr},${cg},${cb}`,
      rings,
    });
    // 星誕生バースト
    const count = 4 + ms.power;
    for (let i = 0; i < count; i++) {
      setTimeout(() => this.triggerStarBirth(), i * 150);
    }
  }

  // ─────────────────────────── main render ─────────────────────

  render(timeCtrl, masterSpeed) {
    this.time++;
    const ctx  = this.ctx;
    const W = this.W, H = this.H;
    const phase    = timeCtrl.currentPhaseIndex;
    const progress = timeCtrl.phaseProgress;
    const normTime = timeCtrl.getNormalizedTime();
    const cosmicTime = timeCtrl.cosmicTime;
    const speed = Math.abs(masterSpeed);
    const ambient = timeCtrl.ambientPhase;

    // アンビエントブレンド更新
    if (this.ambientTarget !== this.ambientPhase) {
      this.ambientBlend += 0.005;
      if (this.ambientBlend >= 1) {
        this.ambientBlend  = 0;
        this.ambientPhase  = this.ambientTarget;
      }
    }

    // フェーズ変化
    if (phase !== this.lastPhaseIndex) {
      if (phase >= 2) this.triggerStarBirth();
      this.lastPhaseIndex = phase;
    }
    if (phase >= 2 && Math.random() < 0.002 + speed * 0.01) {
      this.triggerStarBirth();
    }

    // ─── 描画 ───
    this._drawBackground(ctx, W, H, phase, progress, ambient, timeCtrl.ambientBlend || this.ambientBlend);
    this._drawNebulae(ctx, phase, normTime);
    this._drawStars(ctx, cosmicTime, normTime, speed, ambient);

    // アンビエント別レイヤー
    if (ambient === 3 || this.ambientTarget === 3) this._drawRain(ctx, W, H, this.ambientBlend);
    if (ambient === 4 || this.ambientTarget === 4) this._drawAurora(ctx, W, H, this.ambientBlend);
    if (ambient === 5) this._drawDawn(ctx, W, H);

    this._drawParticles(ctx, speed, W, H);
    this._drawEvents(ctx);
    this._drawShootingStars(ctx);

    if (phase === 0) this._drawBigBang(ctx, W, H, cosmicTime, speed);
    if (phase >= 5)  this._drawEarth(ctx, W, H, normTime, ambient);
    if (phase >= 7)  this._drawHumanity(ctx, W, H, normTime);

    this._drawMilestones(ctx, W, H);
  }

  // ─────────────────────────── background ─────────────────────

  _drawBackground(ctx, W, H, phase, progress, ambient, blend) {
    // 宇宙フェーズ色
    const cosmicColors = [
      [255,240,220],[180,100,40],[20,20,60],
      [8,8,40],[4,6,20],[2,4,16],[1,3,8],[0,1,3],
    ];
    const c0 = cosmicColors[Math.min(phase, cosmicColors.length-1)];
    const c1 = cosmicColors[Math.min(phase+1, cosmicColors.length-1)];
    const t  = progress;
    let r = c0[0]+(c1[0]-c0[0])*t;
    let g = c0[1]+(c1[1]-c0[1])*t;
    let b = c0[2]+(c1[2]-c0[2])*t;

    // アンビエントオーバーレイ色
    const ambColors = [
      null,
      [40,20,10],   // 1=黄昏
      [2,4,18],     // 2=深夜
      [5,8,20],     // 3=雨
      [5,15,20],    // 4=オーロラ
      [30,18,10],   // 5=夜明け
    ];
    const ac = ambColors[ambient];
    if (ac && blend > 0) {
      r = r*(1-blend) + ac[0]*blend;
      g = g*(1-blend) + ac[1]*blend;
      b = b*(1-blend) + ac[2]*blend;
    }

    const grad = ctx.createRadialGradient(W/2,H*0.4,0, W/2,H*0.4,W*0.85);
    grad.addColorStop(0, `rgb(${r|0},${g|0},${b|0})`);
    grad.addColorStop(1, `rgb(0,0,0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,W,H);

    // 黄昏: 地平線グロー
    if (ambient === 1) {
      const hg = ctx.createLinearGradient(0,H*0.6,0,H);
      hg.addColorStop(0,`rgba(180,80,20,${0.25*blend})`);
      hg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = hg; ctx.fillRect(0,H*0.6,W,H*0.4);
    }

    // ビネット
    const vig = ctx.createRadialGradient(W/2,H/2,H*0.3, W/2,H/2,H*0.95);
    vig.addColorStop(0,'rgba(0,0,0,0)');
    vig.addColorStop(1,'rgba(0,0,0,0.75)');
    ctx.fillStyle = vig;
    ctx.fillRect(0,0,W,H);
  }

  // ─────────────────────────── rain ─────────────────────────────

  _drawRain(ctx, W, H, blend) {
    // スポーン
    while (this.rainDrops.length < 200 * blend) {
      this.rainDrops.push({
        x: Math.random() * W,
        y: Math.random() * H,
        len: 8 + Math.random() * 14,
        speed: 6 + Math.random() * 8,
        alpha: 0.08 + Math.random() * 0.12,
      });
    }
    ctx.save();
    ctx.strokeStyle = `rgba(150,180,220,${0.18*blend})`;
    ctx.lineWidth = 0.6;
    for (const d of this.rainDrops) {
      d.y += d.speed;
      d.x -= d.speed * 0.15;
      if (d.y > H) { d.y = -d.len; d.x = Math.random() * W; }
      ctx.globalAlpha = d.alpha * blend;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len*0.15, d.y + d.len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 霧レイヤー
    const fog = ctx.createLinearGradient(0,0,0,H);
    fog.addColorStop(0,'rgba(30,40,60,0)');
    fog.addColorStop(1,`rgba(30,40,60,${0.2*blend})`);
    ctx.fillStyle = fog; ctx.fillRect(0,0,W,H);
  }

  // ─────────────────────────── aurora ──────────────────────────

  _drawAurora(ctx, W, H, blend) {
    ctx.save();
    for (const wave of this.auroraWaves) {
      wave.phase += wave.speed;
      ctx.beginPath();
      ctx.moveTo(0, H * wave.yBase);
      for (let x = 0; x <= W; x += 8) {
        const y = H * (wave.yBase + Math.sin(x * 0.006 + wave.phase) * wave.amp
                                  + Math.sin(x * 0.003 + wave.phase*1.3) * wave.amp*0.5);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W,0); ctx.lineTo(0,0); ctx.closePath();
      const gr = ctx.createLinearGradient(0,0,0,H*0.5);
      gr.addColorStop(0,'rgba(0,0,0,0)');
      gr.addColorStop(0.5,`hsla(${wave.hue},80%,55%,${0.06*blend})`);
      gr.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fill();
    }
    ctx.restore();
  }

  // ─────────────────────────── dawn ────────────────────────────

  _drawDawn(ctx, W, H) {
    const dawnGrad = ctx.createLinearGradient(0, H*0.5, 0, H);
    dawnGrad.addColorStop(0,`rgba(200,100,30,0.15)`);
    dawnGrad.addColorStop(0.4,`rgba(220,140,40,0.08)`);
    dawnGrad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = dawnGrad; ctx.fillRect(0,H*0.5,W,H*0.5);

    // 太陽の淡い輪郭
    const sunX = W*0.5, sunY = H*0.72;
    const sunGrad = ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,80);
    sunGrad.addColorStop(0,'rgba(255,200,80,0.2)');
    sunGrad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath(); ctx.arc(sunX,sunY,80,0,Math.PI*2); ctx.fill();
  }

  // ─────────────────────────── stars ────────────────────────────

  _drawStars(ctx, cosmicTime, normTime, speed, ambient) {
    // アンビエント別の星の明るさ係数
    const ambBrightness = [1, 0.5, 1.2, 0.6, 1.1, 0.4];
    const brightMult = ambBrightness[Math.min(ambient, ambBrightness.length-1)];

    for (const star of this.stars) {
      if (cosmicTime < star.born) continue;
      star.twinklePhase += star.twinkleSpeed;
      const twinkle = 0.4 + 0.6 * Math.sin(star.twinklePhase);
      const alpha   = star.brightness * twinkle
                    * Math.min(1, (cosmicTime - star.born) * 2)
                    * brightMult;
      const colors  = [
        `rgba(255,255,255,${alpha})`,
        `rgba(150,170,255,${alpha})`,
        `rgba(255,200,120,${alpha})`,
      ];
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r*(1+speed*0.4), 0, Math.PI*2);
      ctx.fillStyle = colors[star.type];
      ctx.fill();

      if (star.brightness > 0.75) {
        const glow = ctx.createRadialGradient(star.x,star.y,0, star.x,star.y,star.r*5);
        glow.addColorStop(0, colors[star.type]);
        glow.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(star.x,star.y,star.r*5,0,Math.PI*2); ctx.fill();
      }
    }
  }

  // ─────────────────────────── nebulae ─────────────────────────

  _drawNebulae(ctx, phase, normTime) {
    if (phase < 2) return;
    const vis = Math.min(1,(normTime-0.15)*5);
    ctx.save();
    for (const neb of this.nebulae) {
      neb.alpha += (neb.targetAlpha*vis - neb.alpha)*0.015;
      if (neb.alpha < 0.001) continue;
      ctx.save();
      ctx.translate(neb.x,neb.y);
      ctx.rotate(neb.rotation + this.time*0.00008);
      const grad = ctx.createRadialGradient(0,0,0,0,0,neb.rx);
      grad.addColorStop(0,`hsla(${neb.hue},55%,55%,${neb.alpha})`);
      grad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.scale(1, neb.ry/neb.rx);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(0,0,neb.rx,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // ─────────────────────────── particles ───────────────────────

  _spawnParticle(random=false) {
    this.particles.push({
      x: random ? Math.random()*this.W : this.W/2+(Math.random()-0.5)*30,
      y: random ? Math.random()*this.H : this.H/2+(Math.random()-0.5)*30,
      vx: (Math.random()-0.5)*0.25,
      vy: (Math.random()-0.5)*0.25,
      life: Math.random(),
      r: Math.random()*1.8,
      hue: Math.random()*60+20,
    });
  }

  _drawParticles(ctx, speed, W, H) {
    if (Math.random() < 0.25+speed*2 && this.particles.length < 300) this._spawnParticle();
    for (let i = this.particles.length-1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx+(Math.random()-0.5)*0.08;
      p.y += p.vy+(Math.random()-0.5)*0.08;
      p.life -= 0.0018;
      if (p.life<=0||p.x<-10||p.x>W+10||p.y<-10||p.y>H+10) {
        this.particles.splice(i,1); continue;
      }
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`hsla(${p.hue},75%,65%,${p.life*0.25})`;
      ctx.fill();
    }
  }

  // ─────────────────────────── events ──────────────────────────

  _drawEvents(ctx) {
    for (let i = this.events.length-1; i >= 0; i--) {
      const ev = this.events[i];
      ev.life -= 0.012;
      if (ev.life<=0) { this.events.splice(i,1); continue; }
      ev.r = ev.maxR*(1-ev.life);
      const grad = ctx.createRadialGradient(ev.x,ev.y,0,ev.x,ev.y,ev.r);
      grad.addColorStop(0,`rgba(255,240,180,${ev.life*0.5})`);
      grad.addColorStop(0.5,`rgba(100,150,255,${ev.life*0.25})`);
      grad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=grad;
      ctx.beginPath(); ctx.arc(ev.x,ev.y,ev.r,0,Math.PI*2); ctx.fill();
    }
  }

  // ─────────────────────────── big bang ────────────────────────

  _drawShootingStars(ctx) {
    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const s = this.shootingStars[i];
      s.life -= s.decay;
      if (s.life <= 0) { this.shootingStars.splice(i, 1); continue; }

      s.x += s.vx;
      s.y += s.vy;

      const tailX = s.x - s.vx * (s.len / Math.sqrt(s.vx*s.vx+s.vy*s.vy));
      const tailY = s.y - s.vy * (s.len / Math.sqrt(s.vx*s.vx+s.vy*s.vy));

      const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
      grad.addColorStop(0, `rgba(255,255,255,0)`);
      grad.addColorStop(0.6, `rgba(200,220,255,${s.life * 0.4})`);
      grad.addColorStop(1,   `rgba(255,255,255,${s.life * 0.9})`);

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5 * s.life;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();

      // 先端グロー
      const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 6);
      glow.addColorStop(0, `rgba(220,240,255,${s.life * 0.8})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  _drawBigBang(ctx, W, H, cosmicTime, speed) {
    if (cosmicTime >= 0.3) return;
    const intensity = Math.max(0,1-cosmicTime*5)+speed*0.4;
    if (intensity < 0.005) return;
    const grad = ctx.createRadialGradient(W/2,H*0.4,0,W/2,H*0.4,W*0.6);
    grad.addColorStop(0,`rgba(255,255,255,${Math.min(0.9,intensity)})`);
    grad.addColorStop(0.3,`rgba(255,200,100,${intensity*0.35})`);
    grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
  }

  // ─────────────────────────── earth ───────────────────────────

  _drawEarth(ctx, W, H, normTime, ambient) {
    const eX = W*0.5, eY = H*0.35;
    const eR = 40+(normTime-0.6)*80;
    if (eR<=0) return;
    const alpha = Math.min(0.6,(normTime-0.6)*3);

    // アンビエントで色変化
    let oceanR=80, oceanG=160, oceanB=220;
    if (ambient===1) { oceanR=200; oceanG=100; oceanB=60; } // 黄昏
    if (ambient===2) { oceanR=20;  oceanG=30;  oceanB=80; } // 夜

    const grad = ctx.createRadialGradient(eX-eR*0.3,eY-eR*0.3,eR*0.1,eX,eY,eR);
    grad.addColorStop(0,`rgba(${oceanR},${oceanG},${oceanB},${alpha})`);
    grad.addColorStop(0.4,`rgba(40,120,60,${alpha*0.8})`);
    grad.addColorStop(0.8,`rgba(20,60,120,${alpha*0.6})`);
    grad.addColorStop(1,`rgba(0,0,20,${alpha*0.3})`);
    ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(eX,eY,eR,0,Math.PI*2); ctx.fill();

    const atmo = ctx.createRadialGradient(eX,eY,eR*0.9,eX,eY,eR*1.2);
    atmo.addColorStop(0,`rgba(100,180,255,${alpha*0.3})`);
    atmo.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=atmo; ctx.beginPath(); ctx.arc(eX,eY,eR*1.2,0,Math.PI*2); ctx.fill();
  }

  // ─────────────────────────── humanity ────────────────────────

  _drawHumanity(ctx, W, H, normTime) {
    const alpha = Math.min(0.12,(normTime-0.95)*2.4);
    ctx.beginPath(); ctx.arc(W*0.5+15,H*0.38,2,0,Math.PI*2);
    ctx.fillStyle=`rgba(255,240,200,${alpha})`; ctx.fill();
  }

  // ─────────────────────────── milestones ──────────────────────

  _drawMilestones(ctx, W, H) {
    for (let i = this.milestoneQueue.length-1; i >= 0; i--) {
      const ms = this.milestoneQueue[i];
      ms.timer--;
      if (ms.timer <= 0) { this.milestoneQueue.splice(i,1); continue; }

      const t = ms.timer / 240; // 1→0

      // 全体パルス（始まりと終わりでフェード）
      const pulse = Math.sin(t * Math.PI) * 0.1;
      ctx.fillStyle=`rgba(${ms.color},${pulse})`;
      ctx.fillRect(0,0,W,H);

      // 複数リング
      for (let ri = 0; ri < ms.rings.length; ri++) {
        const ring = ms.rings[ri];
        const ringT = Math.max(0, (ms.timer - ring.delay*ri) / 240);
        if (ringT <= 0) continue;
        const ringR = (1-ringT) * W * 0.65;
        const ringAlpha = ringT * (1-ringT) * 4 * 0.25;
        ctx.beginPath();
        ctx.arc(W/2, H*0.42, ringR, 0, Math.PI*2);
        ctx.strokeStyle=`rgba(${ms.color},${ringAlpha})`;
        ctx.lineWidth = 1.5 - ri*0.4;
        ctx.stroke();
      }
    }
  }
}
