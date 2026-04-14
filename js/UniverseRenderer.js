/**
 * UniverseRenderer — 歯車の回転で宇宙が生まれる設計
 *
 * ミクロ: 接触点パーティクル、発光
 * メゾ:  粒子蓄積→密度→渦
 * マクロ: マイルストーンリング+フラッシュ
 * アンビエント: 密度/速度/エネルギー依存（時間ベース廃止）
 */
class UniverseRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.resize();

    this.time = 0;

    // ─── 蓄積粒子プール（寿命あり、宇宙に溶け込む） ───
    this.accumParticles = []; // { x,y,vx,vy,hue,r,alpha,life,maxLife }
    this.MAX_ACCUM      = 400;

    // ─── 接触点からの放出パーティクル（短命） ───
    this.contactParticles = []; // { x,y,vx,vy,life,r,hue }

    // ─── 星 ───
    this.stars = [];
    this._initStars();

    // ─── 流れ星 ───
    this.shootingStars = [];

    // ─── マイルストーンエフェクト ───
    this.milestoneQueue = [];

    // ─── 状態（回転ベース） ───
    this.totalEnergy    = 0;   // 右端累積回転数ベース（0〜∞）
    this.currentSpeed   = 0;   // 右端角速度
    this.accumDensity   = 0;   // 0〜1（蓄積粒子密度）
  }

  resize() {
    this.W = this.canvas.width  = window.innerWidth;
    this.H = this.canvas.height = window.innerHeight;
  }

  _initStars() {
    this.stars = [];
    for (let i = 0; i < 650; i++) {
      this.stars.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H,
        r: Math.random() * 1.5 + 0.2,
        brightness: Math.random(),
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.007 + Math.random() * 0.022,
        type: Math.floor(Math.random() * 3),
        bornAt: Math.random() * 500, // totalEnergyがこれを超えたら表示
      });
    }
  }

  // ─────────────────── public API ────────────────────────────

  triggerShootingStar() {
    const W=this.W, H=this.H;
    const spd = 9 + Math.random() * 13;
    const ang  = (0.1 + Math.random()*0.4) * Math.PI;
    this.shootingStars.push({
      x: Math.random()*W*0.8+W*0.1,
      y: Math.random()*H*0.3,
      vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
      len: 55+Math.random()*110,
      life: 1, decay: 0.02+Math.random()*0.015,
    });
  }

  triggerMilestone(ms) {
    const [cr,cg,cb] = ms.color;
    this.milestoneQueue.push({
      timer: 260, maxTimer: 260,
      color: `${cr},${cg},${cb}`,
      rings: [0, 30, 60].map(d => ({ delay: d })),
    });
    // パーティクルバースト
    const count = 6 + (ms.power || 3) * 2;
    for (let i = 0; i < count; i++) {
      setTimeout(() => this._burstParticles(this.W/2, this.H*0.42, cr, cg, cb), i*120);
    }
  }

  _burstParticles(cx, cy, r=200, g=180, b=100) {
    for (let i = 0; i < 18; i++) {
      const ang = Math.random()*Math.PI*2;
      const spd = 1.5 + Math.random()*3;
      this.contactParticles.push({
        x:cx, y:cy,
        vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd,
        life:1, decay:0.012+Math.random()*0.01,
        r:1.5+Math.random()*2,
        hue: Math.atan2(g-128, r-128)*180/Math.PI,
      });
    }
  }

  // ─────────────────── メインレンダ ──────────────────────────

  /**
   * @param {TimeController} timeCtrl
   * @param {number} masterSpeed     右端角速度
   * @param {number} totalRightRot   右端累積回転数
   * @param {Array}  contactPoints   GearRenderer.contactPoints
   */
  render(timeCtrl, masterSpeed, totalRightRot, contactPoints) {
    this.time++;
    const ctx = this.ctx;
    const W=this.W, H=this.H;
    const speed = Math.abs(masterSpeed);

    // 状態更新
    this.totalEnergy  = totalRightRot;
    this.currentSpeed = speed;
    this.accumDensity = Math.min(1, this.accumParticles.length / this.MAX_ACCUM);

    // アンビエント計算（回転ベース）
    const fog     = Math.min(0.6, this.accumDensity * 0.7);          // 密度→霧
    const wind    = Math.min(1, speed * 20);                          // 速度→風
    const aurora  = Math.min(1, this.totalEnergy / 50000);            // 高エネルギー→オーロラ
    const rain    = this.accumDensity > 0.5 && speed > 0.01           // 高密度+高速→雨
                    ? Math.min(1, (this.accumDensity - 0.5)*2) : 0;

    // 接触点から粒子放出
    this._emitContactParticles(contactPoints, speed);

    // 蓄積粒子を追加（回転速度に比例）
    this._accumulateParticles(speed, W, H);

    // ─── 描画 ───
    this._drawBackground(ctx, W, H, fog, aurora);
    this._drawAccumParticles(ctx, W, H, wind);
    if (aurora > 0.05) this._drawAurora(ctx, W, H, aurora);
    if (rain > 0.05)   this._drawRain(ctx, W, H, rain);
    this._drawStars(ctx, W, H, speed);
    this._drawContactParticles(ctx);
    this._drawShootingStars(ctx);
    this._drawMilestones(ctx, W, H);

    // 宇宙フェーズ描画（地球など）
    const phase    = timeCtrl.currentPhaseIndex;
    const normTime = timeCtrl.getNormalizedTime();
    if (phase >= 5) this._drawEarth(ctx, W, H, normTime, rain);
    if (phase >= 7) this._drawHumanity(ctx, W, H, normTime);
  }

  // ─────────────────── 背景 ──────────────────────────────────

  _drawBackground(ctx, W, H, fog, aurora) {
    // 基本は黒〜深宇宙
    const density = this.accumDensity;
    const energy  = Math.min(1, this.totalEnergy / 100);

    // 蓄積に応じて宇宙色が深まる
    const br = (energy * 12)|0;
    const bg_val = `rgb(${br},${br},${Math.min(40, br+8)})`;

    // 放射グラデ
    const grad = ctx.createRadialGradient(W/2, H*0.38, 0, W/2, H*0.38, W*0.9);
    grad.addColorStop(0, bg_val);
    grad.addColorStop(1, 'rgb(0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

    // 霧（蓄積密度）
    if (fog > 0.02) {
      ctx.fillStyle = `rgba(15,18,35,${fog * 0.35})`;
      ctx.fillRect(0,0,W,H);
    }

    // ビネット
    const vig = ctx.createRadialGradient(W/2,H/2,H*0.28, W/2,H/2,H*1.0);
    vig.addColorStop(0,'rgba(0,0,0,0)');
    vig.addColorStop(1,'rgba(0,0,0,0.72)');
    ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
  }

  // ─────────────────── 星 ────────────────────────────────────

  _drawStars(ctx, W, H, speed) {
    const energy = this.totalEnergy;
    for (const s of this.stars) {
      if (energy < s.bornAt) continue;
      s.twinklePhase += s.twinkleSpeed;
      const tw  = 0.4 + 0.6*Math.sin(s.twinklePhase);
      const born= Math.min(1, (energy - s.bornAt) / 50);
      const al  = s.brightness * tw * born;
      const cs  = ['rgba(255,255,255,','rgba(150,170,255,','rgba(255,200,120,'];
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r*(1+speed*0.4), 0, Math.PI*2);
      ctx.fillStyle = cs[s.type] + al + ')'; ctx.fill();
      if (s.brightness > 0.78) {
        const gw = ctx.createRadialGradient(s.x,s.y,0, s.x,s.y,s.r*5);
        gw.addColorStop(0, cs[s.type]+al*0.6+')');
        gw.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=gw; ctx.beginPath(); ctx.arc(s.x,s.y,s.r*5,0,Math.PI*2); ctx.fill();
      }
    }
  }

  // ─────────────────── 接触点パーティクル ──────────────────────

  _emitContactParticles(contactPoints, speed) {
    if (!contactPoints || speed < 0.0003) return;
    for (const cp of contactPoints) {
      const count = Math.ceil(speed * 40);
      for (let i = 0; i < Math.min(count, 4); i++) {
        const ang = -Math.PI*0.6 + (Math.random()-0.5)*1.2; // 左上方向に飛ぶ
        const spd = 0.5 + Math.random()*2 + speed*15;
        this.contactParticles.push({
          x: cp.x + (Math.random()-0.5)*6,
          y: cp.y + (Math.random()-0.5)*6,
          vx: Math.cos(ang)*spd,
          vy: Math.sin(ang)*spd - 0.3,
          life: 1,
          decay: 0.018 + Math.random()*0.025,
          r: 0.8 + Math.random()*1.8,
          hue: 30 + Math.random()*40,
        });
      }
    }
  }

  _drawContactParticles(ctx) {
    for (let i = this.contactParticles.length-1; i >= 0; i--) {
      const p = this.contactParticles[i];
      p.life -= p.decay;
      if (p.life <= 0) { this.contactParticles.splice(i,1); continue; }
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.96; p.vy = p.vy*0.96 - 0.04;

      // 一部は蓄積粒子に昇格
      if (p.life < 0.3 && Math.random() < 0.08 && this.accumParticles.length < this.MAX_ACCUM) {
        this.accumParticles.push({
          x:p.x, y:p.y, vx:p.vx*0.1, vy:p.vy*0.1,
          hue:p.hue, r:Math.min(p.r*0.7, 0.9), alpha:0.45, life:1.0, maxLife:200+Math.random()*200,
        });
      }

      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`hsla(${p.hue},85%,68%,${p.life*0.8})`;
      ctx.fill();
    }
  }

  // ─────────────────── 蓄積粒子 ────────────────────────────────

  _accumulateParticles(speed, W, H) {
    if (speed < 0.0002) return;
    const spawnCount = Math.min(2, Math.ceil(speed * 5));
    for (let i = 0; i < spawnCount; i++) {
      if (this.accumParticles.length >= this.MAX_ACCUM) break;
      const maxLife = 280 + Math.random() * 320; // 寿命（フレーム数）
      this.accumParticles.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.82,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        hue: Math.random() * 80 + 180, // 青〜紫系
        r: 0.4 + Math.random() * 1.0,  // 小さめ固定
        alpha: 0.5 + Math.random() * 0.3,
        life: 1.0,
        maxLife,
      });
    }
  }

  _drawAccumParticles(ctx, W, H, wind) {
    const density = this.accumDensity;
    const cx = W * 0.5, cy = H * 0.42;

    for (let i = this.accumParticles.length - 1; i >= 0; i--) {
      const p = this.accumParticles[i];

      // 寿命を減らす → 宇宙に溶け込む
      p.life -= 1 / p.maxLife;
      if (p.life <= 0) { this.accumParticles.splice(i, 1); continue; }

      // 移動（風 + 渦引力）
      p.x += p.vx - wind * 0.3;
      p.y += p.vy;

      // 高密度時だけ中心引力（渦）
      if (density > 0.5) {
        const dx = cx - p.x, dy = cy - p.y;
        const dist = Math.sqrt(dx*dx + dy*dy) + 1;
        const pull = 0.003 * (density - 0.5);
        p.vx += dx/dist*pull - dy/dist*0.002;
        p.vy += dy/dist*pull + dx/dist*0.002;
      }
      p.vx *= 0.995; p.vy *= 0.995;

      // 画面端ループ（上下はラップしない）
      if (p.x < 0) p.x += W;
      if (p.x > W) p.x -= W;

      // 透明度 = alpha × life（末期はフェードアウト）
      // lifeが0.2以下でゆっくり消える
      const fadeAlpha = p.life < 0.25 ? p.alpha * (p.life / 0.25) : p.alpha;

      if (fadeAlpha < 0.01) continue;

      // 点だけ描画（グローなし）
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue},70%,70%,${fadeAlpha * 0.55})`;
      ctx.fill();
    }
  }

  // ─────────────────── オーロラ ───────────────────────────────

  _drawAurora(ctx, W, H, intensity) {
    const t = this.time;
    ctx.save();
    const waves = [
      { ph:t*0.004,   hue:140, yb:0.12, amp:0.07 },
      { ph:t*0.006+1, hue:180, yb:0.18, amp:0.05 },
      { ph:t*0.005+2, hue:200, yb:0.22, amp:0.06 },
    ];
    for (const w of waves) {
      ctx.beginPath(); ctx.moveTo(0,H*w.yb);
      for (let x=0; x<=W; x+=8) {
        const y=H*(w.yb+Math.sin(x*0.005+w.ph)*w.amp+Math.sin(x*0.003+w.ph*1.4)*w.amp*0.4);
        ctx.lineTo(x,y);
      }
      ctx.lineTo(W,0); ctx.lineTo(0,0); ctx.closePath();
      const gr=ctx.createLinearGradient(0,0,0,H*0.4);
      gr.addColorStop(0,'rgba(0,0,0,0)');
      gr.addColorStop(0.5,`hsla(${w.hue},80%,55%,${0.07*intensity})`);
      gr.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=gr; ctx.fill();
    }
    ctx.restore();
  }

  // ─────────────────── 雨 ──────────────────────────────────────

  _drawRain(ctx, W, H, intensity) {
    if (!this._rainDrops) {
      this._rainDrops = Array.from({length:180},()=>({
        x:Math.random()*W, y:Math.random()*H,
        len:8+Math.random()*14,
        spd:5+Math.random()*8,
        al:0.07+Math.random()*0.1,
      }));
    }
    ctx.save();
    ctx.strokeStyle=`rgba(140,170,220,${0.2*intensity})`;
    ctx.lineWidth=0.6;
    for (const d of this._rainDrops) {
      d.y+=d.spd; d.x-=d.spd*0.12;
      if(d.y>H){d.y=-d.len;d.x=Math.random()*W;}
      ctx.globalAlpha=d.al*intensity;
      ctx.beginPath();
      ctx.moveTo(d.x,d.y); ctx.lineTo(d.x-d.len*0.12,d.y+d.len);
      ctx.stroke();
    }
    ctx.globalAlpha=1; ctx.restore();
  }

  // ─────────────────── 流れ星 ──────────────────────────────────

  _drawShootingStars(ctx) {
    for (let i=this.shootingStars.length-1; i>=0; i--) {
      const s=this.shootingStars[i];
      s.life-=s.decay; if(s.life<=0){this.shootingStars.splice(i,1);continue;}
      s.x+=s.vx; s.y+=s.vy;
      const mag=Math.sqrt(s.vx*s.vx+s.vy*s.vy);
      const tx=s.x-s.vx/mag*s.len, ty=s.y-s.vy/mag*s.len;
      const gr=ctx.createLinearGradient(tx,ty,s.x,s.y);
      gr.addColorStop(0,'rgba(255,255,255,0)');
      gr.addColorStop(0.6,`rgba(200,220,255,${s.life*0.45})`);
      gr.addColorStop(1,`rgba(255,255,255,${s.life*0.9})`);
      ctx.save(); ctx.strokeStyle=gr; ctx.lineWidth=1.5*s.life;
      ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(s.x,s.y); ctx.stroke();
      const gw=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,7);
      gw.addColorStop(0,`rgba(220,240,255,${s.life*0.8})`);
      gw.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=gw; ctx.beginPath(); ctx.arc(s.x,s.y,7,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  // ─────────────────── マイルストーン ──────────────────────────

  _drawMilestones(ctx, W, H) {
    for (let i=this.milestoneQueue.length-1; i>=0; i--) {
      const ms=this.milestoneQueue[i];
      ms.timer--;
      if(ms.timer<=0){this.milestoneQueue.splice(i,1);continue;}
      const t=ms.timer/ms.maxTimer;
      ctx.fillStyle=`rgba(${ms.color},${Math.sin(t*Math.PI)*0.1})`;
      ctx.fillRect(0,0,W,H);
      for(const ring of ms.rings){
        const rt=Math.max(0,(ms.timer-ring.delay)/ms.maxTimer);
        if(rt<=0)continue;
        const rr=(1-rt)*W*0.6;
        ctx.beginPath(); ctx.arc(W/2,H*0.42,rr,0,Math.PI*2);
        ctx.strokeStyle=`rgba(${ms.color},${rt*(1-rt)*3*0.3})`;
        ctx.lineWidth=1.5; ctx.stroke();
      }
    }
  }

  // ─────────────────── 地球・人類 ──────────────────────────────

  _drawEarth(ctx, W, H, normTime, rain) {
    const eX=W*0.5, eY=H*0.35;
    const eR=40+(normTime-0.6)*80; if(eR<=0)return;
    const al=Math.min(0.6,(normTime-0.6)*3);
    const or=rain>0.2 ? 40 : 80;
    const gr=ctx.createRadialGradient(eX-eR*0.3,eY-eR*0.3,eR*0.1,eX,eY,eR);
    gr.addColorStop(0,`rgba(${or},160,220,${al})`);
    gr.addColorStop(0.4,`rgba(40,120,60,${al*0.8})`);
    gr.addColorStop(0.8,`rgba(20,60,120,${al*0.6})`);
    gr.addColorStop(1,`rgba(0,0,20,${al*0.3})`);
    ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(eX,eY,eR,0,Math.PI*2); ctx.fill();
    const at=ctx.createRadialGradient(eX,eY,eR*0.9,eX,eY,eR*1.2);
    at.addColorStop(0,`rgba(100,180,255,${al*0.3})`); at.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=at; ctx.beginPath(); ctx.arc(eX,eY,eR*1.2,0,Math.PI*2); ctx.fill();
  }

  _drawHumanity(ctx, W, H, normTime) {
    const al=Math.min(0.12,(normTime-0.95)*2.4);
    ctx.beginPath(); ctx.arc(W*0.5+15,H*0.38,2,0,Math.PI*2);
    ctx.fillStyle=`rgba(255,240,200,${al})`; ctx.fill();
  }
}
