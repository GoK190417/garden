(() => {
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;
const rand = (a,b) => a + Math.random()*(b-a);

const S = { count:26, glow:1, shy:140, blink:3 };

/* ---------- 生成背景レイヤー設定(Step 2) ---------- */
const USE_IMAGE_BG = true;            // false で従来の手続き背景に戻す
const BG_SRC    = 'assets/bg.jpg';
const FOCUS     = { x:0.5, y:0.55 };  // cover クロップの見せたい点(0.5,0.5=中央)
const DARKEN    = 0.15;               // 画像の上に重ねる藍の暗幕の濃さ
const WATER_IMG = 0.78;               // 画像高さに対する水面位置(?cal=1 で調整)

let W, H, dpr, waterY;
let bg, grassBack, grassFront, sprite, vignette, mist1, grainPat;
let bgImg = null, bgReady = false, useImg = false;
let bgT = { ox:0, oy:0, scale:1, iw:0, ih:0 };  // cover 変換(?cal=1 で再利用)
const CAL = new URLSearchParams(location.search).get('cal') === '1';  // ?cal=1 で水位調整
let calDrag = false;
let bokehs = [];
let flies = [], rings = [], twinks = [];
let pointer = { x:0, y:0, down:false };
let firstTouch = false, hint2done = false, hintTimer = null;
let idleT = 0, last = performance.now();

/* ---------- offscreen builders ---------- */
function offCanvas(){
  const o = document.createElement('canvas');
  o.width = Math.ceil(W*dpr); o.height = Math.ceil(H*dpr);
  const c = o.getContext('2d'); c.scale(dpr,dpr);
  return [o,c];
}

function buildSprite(){
  sprite = document.createElement('canvas');
  sprite.width = sprite.height = 128;
  const c = sprite.getContext('2d');
  const g = c.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,  'rgba(255,252,228,0.95)');
  g.addColorStop(0.18,'rgba(232,248,170,0.55)');
  g.addColorStop(0.5, 'rgba(190,228,140,0.16)');
  g.addColorStop(1,  'rgba(160,210,120,0)');
  c.fillStyle = g; c.fillRect(0,0,128,128);
}

function buildBG(){
  const [o,c] = offCanvas(); bg = o;
  // 夜藍の空
  const sky = c.createLinearGradient(0,0,0,waterY);
  sky.addColorStop(0,'#04081a');
  sky.addColorStop(0.45,'#0a1430');
  sky.addColorStop(0.8,'#142650');
  sky.addColorStop(1,'#1e3565');
  c.fillStyle = sky; c.fillRect(0,0,W,waterY);
  // 星
  twinks = [];
  for(let i=0;i<95;i++){
    const x = rand(0,W), y = rand(0,waterY*0.82), r = rand(0.4,1.3), a = rand(0.15,0.6);
    if(i < 16){ twinks.push({x,y,r,base:a,f:rand(0.4,1.2),p:rand(0,TAU)}); continue; }
    c.globalAlpha = a;
    c.fillStyle = ['#dde6ff','#ffeedd','#cfd9ff'][i % 3];
    c.beginPath(); c.arc(x,y,r,0,TAU); c.fill();
  }
  c.globalAlpha = 1;
  // 月と暈
  const mx = W*0.76, my = H*0.15, mr = Math.min(W,H)*0.045;
  const halo = c.createRadialGradient(mx,my,mr*0.4,mx,my,mr*5);
  halo.addColorStop(0,'rgba(244,238,216,0.26)');
  halo.addColorStop(1,'rgba(244,238,216,0)');
  c.fillStyle = halo; c.beginPath(); c.arc(mx,my,mr*5,0,TAU); c.fill();
  const halo2 = c.createRadialGradient(mx,my,mr,mx,my,mr*2.2);
  halo2.addColorStop(0,'rgba(250,242,210,0.22)');
  halo2.addColorStop(1,'rgba(250,242,210,0)');
  c.fillStyle = halo2; c.beginPath(); c.arc(mx,my,mr*2.2,0,TAU); c.fill();
  const md = c.createRadialGradient(mx-mr*0.35,my-mr*0.35,mr*0.1,mx,my,mr);
  md.addColorStop(0,'#fdf8e8');
  md.addColorStop(0.7,'#efe6c6');
  md.addColorStop(1,'#d6cfae');
  c.fillStyle = md;
  c.beginPath(); c.arc(mx,my,mr,0,TAU); c.fill();

  // 遠山と木立(空気遠近)
  ridge(c, waterY, 0.15, '#13234b', 0.55, 3.1);
  ridge(c, waterY, 0.065, '#0c1838', 0.9, 7.7);
  const haze = c.createLinearGradient(0, waterY-H*0.12, 0, waterY);
  haze.addColorStop(0,'rgba(150,170,220,0)');
  haze.addColorStop(1,'rgba(150,170,220,0.10)');
  c.fillStyle = haze; c.fillRect(0, waterY-H*0.12, W, H*0.12);
  // 水面
  const wt = c.createLinearGradient(0,waterY,0,H);
  wt.addColorStop(0,'#0a1430'); wt.addColorStop(1,'#050b1d');
  c.fillStyle = wt; c.fillRect(0,waterY,W,H-waterY);
  c.fillStyle = 'rgba(170,200,255,0.12)';
  c.fillRect(0,waterY,W,1.2);
  const rg = c.createLinearGradient(0,waterY,0,waterY+H*0.07);
  rg.addColorStop(0,'rgba(12,24,56,0.55)');
  rg.addColorStop(1,'rgba(12,24,56,0)');
  c.fillStyle = rg; c.fillRect(0,waterY,W,H*0.07);
  // 月の映り
  const col = c.createLinearGradient(0,waterY,0,H);
  col.addColorStop(0,'rgba(243,238,216,0.14)');
  col.addColorStop(1,'rgba(243,238,216,0)');
  c.fillStyle = col;
  c.fillRect(mx - mr*0.8, waterY, mr*1.6, H-waterY);
}

function buildGrass(color, hMin, hMax, baseY, density, seed){
  const [o,c] = offCanvas();
  c.strokeStyle = color; c.lineCap = 'round';
  for(let x=-12; x<W+12; x += rand(4.5, 4.5+density)){
    const clump = Math.pow(Math.abs(Math.sin(x*0.012 + seed)), 1.6);
    if(clump < 0.18) continue;
    const h = rand(hMin,hMax) * (0.45 + 0.55*clump);
    const lean = rand(-0.4,0.4);
    c.lineWidth = rand(1,2);
    c.beginPath();
    c.moveTo(x, baseY);
    c.quadraticCurveTo(x + lean*h*0.35, baseY - h*0.6, x + lean*h, baseY - h);
    c.stroke();
  }
  return o;
}

function ridge(c, baseY, hScale, color, alpha, seed){
  c.globalAlpha = alpha; c.fillStyle = color;
  c.beginPath(); c.moveTo(0, baseY);
  for(let x=0; x<=W; x+=6){
    const y = baseY - H*hScale*(0.45
      + 0.30*Math.sin(x*0.006 + seed)
      + 0.18*Math.sin(x*0.017 + seed*2.3)
      + 0.07*Math.sin(x*0.045 + seed*4.1));
    c.lineTo(x, y);
  }
  c.lineTo(W, baseY); c.closePath(); c.fill();
  c.globalAlpha = 1;
}

function buildVignette(){
  const [o,c] = offCanvas(); vignette = o;
  const g = c.createRadialGradient(W/2, H*0.42, Math.min(W,H)*0.45,
                                   W/2, H*0.55, Math.hypot(W,H)*0.62);
  g.addColorStop(0,'rgba(2,5,14,0)');
  g.addColorStop(1,'rgba(2,5,14,0.5)');
  c.fillStyle = g; c.fillRect(0,0,W,H);
}

function buildMist(){
  const o = document.createElement('canvas');
  o.width = Math.ceil(W*1.4*dpr); o.height = Math.ceil(H*0.16*dpr);
  const c = o.getContext('2d'); c.scale(dpr,dpr);
  const mw = W*1.4, mh = H*0.16;
  for(let i=0;i<26;i++){
    const x = rand(0,mw), y = rand(mh*0.2,mh*0.9), r = rand(mh*0.25,mh*0.7);
    const g = c.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(165,185,230,0.05)');
    g.addColorStop(1,'rgba(165,185,230,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x,y,r,0,TAU); c.fill();
  }
  mist1 = o;
}

function buildGrain(){
  const g = document.createElement('canvas');
  g.width = g.height = 192;
  const c = g.getContext('2d');
  const img = c.createImageData(192,192);
  for(let i=0;i<img.data.length;i+=4){
    const v = 110 + (Math.random()*90|0);
    img.data[i]=img.data[i+1]=img.data[i+2]=v;
    img.data[i+3] = Math.random()<0.5 ? 16 : 0;
  }
  c.putImageData(img,0,0);
  grainPat = ctx.createPattern(g,'repeat');
}

function initBokeh(){
  bokehs = Array.from({length:3}, () => ({
    x: rand(0,W), y: rand(H*0.25,H*0.7), r: rand(34,64),
    vx: rand(4,9)*(Math.random()<0.5?-1:1),
    ph: rand(0,TAU), pm: rand(0.8,1.25)
  }));
}

/* ---------- flies ---------- */
function newFly(){
  const hx = rand(W*0.08, W*0.92);
  const hy = rand(H*0.30, waterY - 24);
  return {
    x: hx + rand(-50,50), y: hy + rand(-40,40),
    vx:0, vy:0, hx, hy,
    ph: rand(0,TAU), pmul: rand(0.75,1.3), b:0,
    doused:false, relightAt:0, glowUp:0,
    size: rand(5.5,9.5),
    s1: rand(0,TAU), s2: rand(0,TAU), s3: rand(0,TAU),
    w1: rand(0.25,0.6), w2: rand(0.7,1.3),
    fear: 0, layer: Math.random() < 0.4 ? 0 : 1,
    trail: []
  };
}
function initFlies(){ flies = Array.from({length:S.count}, newFly); }
function matchCount(){
  while(flies.length < S.count) flies.push(newFly());
  if(flies.length > S.count) flies.length = S.count;
}

/* ---------- 背景画像のプリロード(フォールバック必須) ---------- */
function loadBG(){
  if(!USE_IMAGE_BG) return;
  const im = new Image();
  im.onload  = () => { bgImg = im; bgReady = true;  bake(); };
  im.onerror = () => { bgReady = false; /* 画像が無ければ手続き背景のまま続行 */ };
  im.src = BG_SRC;
}

/* ---------- 背景・前景の再ベイク(resize と画像読込で呼ぶ) ---------- */
function bake(){
  useImg = USE_IMAGE_BG && bgReady;
  if(useImg){
    const iw = bgImg.naturalWidth, ih = bgImg.naturalHeight;
    const scale = Math.max(W/iw, H/ih);
    const dw = iw*scale, dh = ih*scale;
    const ox = (W-dw)*FOCUS.x, oy = (H-dh)*FOCUS.y;   // FOCUS.x=0.5 で中央寄せ
    bgT = { ox, oy, scale, iw, ih };
    waterY = oy + WATER_IMG * ih * scale;             // 水位は画像の属性として算出
    const [o,c] = offCanvas(); bg = o;
    c.drawImage(bgImg, ox, oy, dw, dh);               // cover 合成
    c.fillStyle = `rgba(6,10,28,${DARKEN})`;          // 統一感のための藍の暗幕
    c.fillRect(0, 0, W, H);
    twinks = [];                                       // 手続きの星は出さない
  } else {
    waterY = H * 0.80;
    buildBG();                                         // 従来の bg と twinks を生成
  }
  buildVignette();
  buildMist();
  grassBack  = buildGrass('#0d1d3f', 24, 66,  waterY+2, 7, 2.7);
  grassFront = buildGrass('#04091a', 40, 118, waterY+6, 5, 8.1);
  for(const f of flies){
    f.x = Math.min(Math.max(f.x, 8), W-8);
    f.hx = Math.min(Math.max(f.hx, W*0.08), W*0.92);
    f.hy = Math.min(f.hy, waterY-36);
  }
}

/* ---------- resize ---------- */
function resize(){
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.ceil(W*dpr); cv.height = Math.ceil(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  bake();
}

/* ---------- update ---------- */
function update(dt, t){
  idleT = pointer.down ? 0 : idleT + dt;

  // そろい(同期)の強さ: 待つほどに
  let sx=0, sy=0;
  for(const f of flies){ sx += Math.sin(f.ph); sy += Math.cos(f.ph); }
  const R = Math.hypot(sx,sy) / Math.max(1,flies.length);
  const meanPh = Math.atan2(sx,sy);
  const K = Math.min(Math.max((idleT-5)/12, 0), 1) * (RM ? 0.9 : 1.5);

  const slow = RM ? 0.55 : 1;

  for(const f of flies){
    // 明滅
    const period = S.blink * f.pmul;
    f.ph += dt * ( TAU/period + K * R * Math.sin(meanPh - f.ph) * (1 - f.fear) );
    const raw = Math.pow(Math.max(0, Math.sin(f.ph)), 5.5);
    f.b += (raw - f.b) * Math.min(1, dt*9);

    // おどろくと灯を消し、ひと息おいて ひとつずつ灯りなおす
    if(f.fear > 0.5 && !f.doused){ f.doused = true; f.relightAt = 0; f.glowUp = 0; }
    if(f.doused && !pointer.down && f.fear < 0.25 && !f.relightAt)
      f.relightAt = t + rand(0.4, 2.8);
    if(f.doused && f.relightAt && t >= f.relightAt){
      f.doused = false; f.glowUp = 1; f.ph = 0.3;
    }
    if(f.glowUp > 0) f.glowUp = Math.max(0, f.glowUp - dt/1.8);

    // ただよう
    const wa = f.s1 + 1.7*Math.sin(t*f.w1 + f.s1) + 1.1*Math.sin(t*f.w2 + f.s2);
    let ax = Math.cos(wa) * 26 * slow;
    let ay = Math.sin(wa) * 15 * slow + Math.sin(t*1.3 + f.s3) * 10 * slow;

    // 帰ってくる
    const homeK = 0.5 * (1 - f.fear*0.9);
    ax += (f.hx - f.x) * homeK;
    ay += (f.hy - f.y) * homeK;

    // はにかみ: ふれると光を消して逃げる
    if(pointer.down){
      const dx = f.x - pointer.x, dy = f.y - pointer.y;
      const d = Math.hypot(dx,dy) || 1;
      if(d < S.shy){
        const fr = 1 - d/S.shy;
        const push = fr*fr*1400*slow;
        ax += dx/d * push; ay += dy/d * push;
        f.fear = Math.min(1, Math.max(f.fear + fr*dt*16, fr*fr*0.85));
      }
    }
    f.fear *= Math.exp(-dt/1.7);

    f.vx += ax*dt; f.vy += ay*dt;
    const damp = Math.exp(-dt*1.8);
    f.vx *= damp; f.vy *= damp;
    const vmax = (22 + 300*f.fear) * slow;
    const v = Math.hypot(f.vx,f.vy);
    if(v > vmax){ f.vx *= vmax/v; f.vy *= vmax/v; }
    f.x += f.vx*dt; f.y += f.vy*dt;

    // ふち
    if(f.x < 8) f.vx += 30*dt*8; if(f.x > W-8) f.vx -= 30*dt*8;
    if(f.y < H*0.16) f.vy += 30*dt*8; if(f.y > waterY-6) f.vy -= 30*dt*8;

    // 残光のすじ
    if(!RM && f.fear > 0.22){
      f.trail.unshift({x:f.x, y:f.y});
      if(f.trail.length > 7) f.trail.length = 7;
    } else if(f.trail.length){ f.trail.pop(); }
  }

  // 波紋
  for(const r of rings){ r.r += (RM?80:150)*dt; r.a *= Math.exp(-dt*1.5); }
  rings = rings.filter(r => r.a > 0.01);

  // ピンぼけの近景
  for(const b of bokehs){
    b.x += b.vx * dt * (RM ? 0.5 : 1);
    b.ph += dt * TAU / (S.blink * b.pm * 1.7);
    if(b.x < -b.r) b.x = W + b.r;
    if(b.x > W + b.r) b.x = -b.r;
  }

  // ふたつめのヒント: 待つことを教える
  if(firstTouch && !hint2done && idleT > 7){
    hint2done = true; showHint('こんどは まってみて', 5200);
  }
}

/* ---------- draw ---------- */
function litOf(f){
  let lit = f.b * (1 - 0.85*f.fear);
  if(f.glowUp > 0){
    const p = Math.sin((1 - f.glowUp) * Math.PI);
    lit = Math.max(lit, Math.pow(Math.max(0, p), 1.4));
  }
  if(f.doused) lit = 0;
  return lit;
}

function drawFly(f, t){
  const lit = litOf(f);
  if(lit < 0.012){
    // 灯を消して にげる影は ほの見える
    if(f.fear > 0.04 || f.doused){
      ctx.globalAlpha = Math.min(0.34, Math.max(0.1, 0.45*f.fear));
      ctx.fillStyle = '#aebbdd';
      ctx.beginPath(); ctx.arc(f.x, f.y, 1.5, 0, TAU); ctx.fill();
    }
    return;
  }
  const sz = f.size * (1 + 0.5*lit) * S.glow * 3.2;
  ctx.globalAlpha = Math.min(1, lit * Math.min(1.15, S.glow));
  ctx.drawImage(sprite, f.x - sz/2, f.y - sz/2, sz, sz);
  ctx.globalAlpha = Math.min(1, lit);
  ctx.fillStyle = '#fffce8';
  ctx.beginPath(); ctx.arc(f.x, f.y, 1.3, 0, TAU); ctx.fill();
}

function draw(t){
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.drawImage(bg, 0, 0, W, H);

  // またたく星
  ctx.fillStyle = '#dde6ff';
  for(const s of twinks){
    ctx.globalAlpha = s.base * (0.45 + 0.55*Math.sin(t*s.f + s.p));
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 霞
  const mw = W*1.4, mh = H*0.16;
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.85;
  ctx.drawImage(mist1, -W*0.2 + Math.sin(t*0.05)*W*0.06, waterY - mh*0.9, mw, mh);
  ctx.globalAlpha = 0.6;
  ctx.drawImage(mist1, -W*0.25 + Math.sin(t*0.033+2.1)*W*0.09, waterY - mh*0.45, mw, mh);
  ctx.globalAlpha = 1;

  ctx.globalCompositeOperation = 'lighter';

  // 水面のうつりこみ(waterY 以下の矩形に clip)
  ctx.save();
  ctx.beginPath(); ctx.rect(0, waterY, W, H - waterY); ctx.clip();
  for(const f of flies){
    const lit = litOf(f);
    if(lit < 0.02) continue;
    const ry = waterY + (waterY - f.y) * 0.5;
    if(ry > H + 30) continue;
    const w = f.size * S.glow * 1.8;
    const h2 = f.size * S.glow * 4.6;
    ctx.globalAlpha = lit * 0.32;
    ctx.drawImage(sprite, f.x + Math.sin(t*1.7 + f.y*0.05)*2.5 - w/2, ry - h2*0.3, w, h2);
  }
  ctx.restore();

  // 波紋
  ctx.lineWidth = 1;
  for(const r of rings){
    ctx.globalAlpha = r.a;
    ctx.strokeStyle = 'rgba(190,210,255,1)';
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
  }

  // 残光のすじ
  for(const f of flies){
    if(f.trail.length < 2) continue;
    ctx.globalAlpha = 0.22 * f.fear;
    ctx.strokeStyle = '#d8f59b'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(f.trail[0].x, f.trail[0].y);
    for(let i=1;i<f.trail.length;i++) ctx.lineTo(f.trail[i].x, f.trail[i].y);
    ctx.stroke();
  }

  // 蛍(草のうしろ → 草 → 蛍 → 手前の草)。画像背景時は草を描かない。
  for(const f of flies) if(f.layer===0) drawFly(f, t);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  if(!useImg) ctx.drawImage(grassBack, 0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for(const f of flies) if(f.layer===1) drawFly(f, t);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  if(!useImg) ctx.drawImage(grassFront, 0, 0, W, H);

  // ピンぼけの近景蛍(被写界深度)
  ctx.globalCompositeOperation = 'lighter';
  for(const b of bokehs){
    const l = Math.pow(Math.max(0, Math.sin(b.ph)), 3);
    if(l < 0.02) continue;
    ctx.globalAlpha = l * 0.11 * Math.min(1.1, S.glow);
    ctx.drawImage(sprite, b.x - b.r, b.y - b.r, b.r*2, b.r*2);
  }

  // しめり気(ビネットとフィルム粒子)
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.drawImage(vignette, 0, 0, W, H);
  ctx.globalCompositeOperation = 'overlay';
  const ox = RM ? 0 : (Math.random()*192)|0, oy = RM ? 0 : (Math.random()*192)|0;
  ctx.save(); ctx.translate(-ox,-oy);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = grainPat;
  ctx.fillRect(0, 0, W+192, H+192);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

  // 水位キャリブレーション(?cal=1 のときだけ。本番には一切影響しない)
  if(CAL){
    const ratio = useImg ? (waterY - bgT.oy) / (bgT.ih * bgT.scale) : waterY / H;
    ctx.strokeStyle = 'rgba(255,217,138,0.9)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, waterY + 0.5); ctx.lineTo(W, waterY + 0.5); ctx.stroke();
    ctx.fillStyle = 'rgba(255,217,138,0.95)';
    ctx.font = '13px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'bottom';
    ctx.fillText('WATER_IMG = ' + ratio.toFixed(3) + (useImg ? '' : '  (画像なし: waterY/H)'), 14, waterY - 8);
    ctx.font = '11px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'top';
    ctx.fillText('線をドラッグ → この値を main.js の WATER_IMG に', 14, waterY + 8);
    ctx.textBaseline = 'alphabetic';
  }
}

/* ---------- loop ---------- */
function frame(now){
  const dt = Math.min(0.05, (now - last)/1000);
  last = now;
  update(dt, now/1000);
  draw(now/1000);
  requestAnimationFrame(frame);
}

/* ---------- hint ---------- */
const hintEl = document.getElementById('hint');
function showHint(text, ms){
  hintEl.textContent = text;
  hintEl.classList.add('show');
  clearTimeout(hintTimer);
  if(ms) hintTimer = setTimeout(()=>hintEl.classList.remove('show'), ms);
}

/* ---------- pointer ---------- */
let lastRing = 0;
function setP(e){
  pointer.x = e.clientX; pointer.y = e.clientY;
}
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  cv.setPointerCapture(e.pointerId);
  if(CAL && Math.abs(e.clientY - waterY) < 24){ calDrag = true; return; }  // 水位線をつかむ
  setP(e); pointer.down = true;
  if(!firstTouch){ firstTouch = true; hintEl.classList.remove('show'); }
  rings.push({x:pointer.x, y:pointer.y, r:4, a:0.22});
  lastRing = performance.now();
});
cv.addEventListener('pointermove', e => {
  if(calDrag){ waterY = Math.min(Math.max(e.clientY, 0), H); return; }  // 水位線を上下に
  if(!pointer.down) return;
  setP(e);
  const n = performance.now();
  if(n - lastRing > 110){
    rings.push({x:pointer.x, y:pointer.y, r:3, a:0.16});
    lastRing = n;
  }
});
window.addEventListener('pointerup',     () => { pointer.down = false; calDrag = false; });
window.addEventListener('pointercancel', () => { pointer.down = false; calDrag = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());

/* ---------- UI ---------- */
const panel = document.getElementById('panel');
document.getElementById('bTune').addEventListener('click', () => panel.classList.toggle('open'));
document.getElementById('bReset').addEventListener('click', () => { initFlies(); rings=[]; });
document.getElementById('sCount').addEventListener('input', e => { S.count = +e.target.value; matchCount(); });
document.getElementById('sGlow').addEventListener('input',  e => { S.glow  = e.target.value/100; });
document.getElementById('sShy').addEventListener('input',   e => { S.shy   = +e.target.value; });
document.getElementById('sBlink').addEventListener('input', e => { S.blink = +e.target.value; });

const shot = document.getElementById('shot');
document.getElementById('bShot').addEventListener('click', () => {
  document.getElementById('shotImg').src = cv.toDataURL('image/png');
  shot.classList.add('open');
});
document.getElementById('bClose').addEventListener('click', () => shot.classList.remove('open'));

/* ---------- go ---------- */
window.addEventListener('resize', resize);
buildSprite();
buildGrain();
resize();
initFlies();
initBokeh();
loadBG();
setTimeout(()=>{ if(!firstTouch) showHint('ふれてみて', 0); }, 1400);
requestAnimationFrame(frame);
})();
