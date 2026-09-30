/* ══════════════════════════════════════════════
   COSSY REIGN · BLACKOUT
   Endless descent. One run. Instant retry.
   ══════════════════════════════════════════════ */

(function(){
  'use strict';

  /* ── DOM ───────────────────────────────── */
  const canvas        = document.getElementById('game');
  const ctx           = canvas.getContext('2d');
  const stage         = document.getElementById('stage');
  const depthEl       = document.getElementById('depth');
  const livesEl       = document.getElementById('lives');
  const sectorMsgEl   = document.getElementById('sectorMsg');
  const glitchEl      = document.getElementById('glitchOverlay');
  const titleScreen   = document.getElementById('titleScreen');
  const deadScreen    = document.getElementById('deadScreen');
  const titleBestEl   = document.getElementById('titleBest');
  const deadDepthEl   = document.getElementById('deadDepth');
  const deadBestEl    = document.getElementById('deadBest');
  const deadMsgEl     = document.getElementById('deadMsg');

  /* ── CONSTANTS ─────────────────────────── */
  const SECTORS = [
    'ICE WALL', 'NULL ZONE', 'GHOST SEGMENT', 'DARK NET', 'VOID CHAMBER',
    'RED PROTOCOL', 'BLACK ICE', 'THE ABYSS', 'ORPHAN DATA', 'FINAL LAYER'
  ];
  const DEATH_MSGS = [
    'CONNECTION TERMINATED',
    'PACKET LOST',
    'SIGNAL CORRUPTED',
    'NODE UNREACHABLE',
    'TRACE DETECTED',
    'FIREWALL BREACH FAILED',
    'DATA DECAYED',
    'SESSION KILLED',
    'HANDSHAKE REFUSED',
    'ROUTE BLACKHOLED'
  ];
  const GLYPHS = 'アカサタナハマヤラワ0123456789ABCDEF<>/\\{}[]$#%&*';

  const PLAYER_R    = 13;
  const PLAYER_COLL = 24;   // collision diameter
  const BASE_SPEED  = 280;
  const MAX_SPEED   = 820;
  const SECTOR_STEP = 300;  // meters per sector

  /* ── STATE ─────────────────────────────── */
  let LW = 0, LH = 0;

  const S = {
    mode: 'title',
    depth: 0,
    speed: BASE_SPEED,
    player: { x: 0, y: 0, vx: 0 },
    obstacles: [],
    shards: [],
    particles: [],
    rain: [],
    lives: 3,
    invuln: 0,
    blackout: 0,
    shardStreak: 0,
    spawnTimer: 0,
    shardTimer: 0,
    sectorIdx: -1,
    sectorMsgT: 0,
    sectorMsgText: '',
    shake: 0,
    best: Number(localStorage.getItem('cossy_blackout_best') || 0),
    keys: { left: false, right: false },
    touchDir: 0,
    touchActive: false,
    deadTime: 0,
    lastT: 0
  };

  /* ── RESIZE ────────────────────────────── */
  function resize(){
    const rect = stage.getBoundingClientRect();
    LW = rect.width;
    LH = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width  = Math.floor(LW * dpr);
    canvas.height = Math.floor(LH * dpr);
    canvas.style.width  = LW + 'px';
    canvas.style.height = LH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    S.player.x = LW / 2;
    S.player.y = LH * 0.78;

    buildRain();
  }

  function buildRain(){
    S.rain = [];
    const cols = Math.max(12, Math.floor(LW / 18));
    for (let i = 0; i < cols; i++){
      S.rain.push({
        x: i * 18 + 9,
        y: Math.random() * LH,
        speed: 40 + Math.random() * 90,
        ch: randGlyph(),
        chTimer: Math.random() * 0.4
      });
    }
  }

  function randGlyph(){
    return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }

  /* ── SPAWNERS ──────────────────────────── */
  function spawnObstacle(){
    const lanes  = 3;
    const laneW  = LW / lanes;
    const lane   = Math.floor(Math.random() * lanes);
    const span   = Math.random() < 0.25 ? 2 : 1;
    const used   = Math.min(span, lanes - lane);
    const w      = laneW * used - 8;
    const x      = lane * laneW + 4;
    const h      = 26 + Math.random() * 40;

    const r = Math.random();
    let type = 'block';
    if (r > 0.75) type = 'spike';
    else if (r > 0.5) type = 'glitch';

    S.obstacles.push({
      x, y: -h - 20, w, h, type,
      seed: Math.random() * 1000
    });
  }

  function spawnShard(){
    const x = 30 + Math.random() * (LW - 60);
    S.shards.push({
      x, y: -20, r: 9,
      gone: false,
      bob: Math.random() * Math.PI * 2
    });
  }

  function burst(x, y, color){
    color = color || '#00ff41';
    for (let i = 0; i < 10; i++){
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 120;
      S.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.35,
        maxLife: 0.85,
        color
      });
    }
  }

  /* ── COLLISION ─────────────────────────── */
  function hits(px, py, o){
    const r = PLAYER_COLL / 2;
    return (px + r > o.x) &&
           (px - r < o.x + o.w) &&
           (py + r > o.y) &&
           (py - r < o.y + o.h);
  }

  /* ── UPDATE ────────────────────────────── */
  function update(dt){
    /* background rain always runs */
    for (const r of S.rain){
      r.y += r.speed * dt;
      r.chTimer -= dt;
      if (r.chTimer <= 0){
        r.ch = randGlyph();
        r.chTimer = 0.05 + Math.random() * 0.15;
      }
      if (r.y > LH + 20){
        r.y = -20;
        r.x = Math.random() * LW;
      }
    }

    /* particles always run */
    for (const p of S.particles){
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
    }
    S.particles = S.particles.filter(p => p.life > 0);

    /* stop here if not playing */
    if (S.mode !== 'playing'){
      if (S.invuln  > 0) S.invuln  -= dt;
      if (S.blackout> 0) S.blackout-= dt;
      if (S.shake   > 0) S.shake   -= dt;
      if (S.sectorMsgT > 0) S.sectorMsgT -= dt;
      updateHUD();
      return;
    }

    /* speed + depth ramp */
    S.speed = Math.min(MAX_SPEED, BASE_SPEED + S.depth * 0.22);
    S.depth += dt * 12 * (S.speed / BASE_SPEED);

    /* sector change */
    const secNow = Math.floor(S.depth / SECTOR_STEP);
    if (secNow !== S.sectorIdx){
      S.sectorIdx = secNow;
      S.sectorMsgText = 'SECTOR ' + String(secNow + 1).padStart(2, '0') +
                        ' :: ' + SECTORS[secNow % SECTORS.length];
      S.sectorMsgT = 2.2;
      flashGlitch();
    }

    /* player movement */
    const accel = 2800;
    const maxV  = 620;
    const friction = 0.82;

    if (S.keys.left  || S.touchDir === -1) S.player.vx -= accel * dt;
    if (S.keys.right || S.touchDir ===  1) S.player.vx += accel * dt;
    if (!S.keys.left && !S.keys.right && S.touchDir === 0){
      S.player.vx *= Math.pow(friction, dt * 60);
    }
    S.player.vx = Math.max(-maxV, Math.min(maxV, S.player.vx));
    S.player.x += S.player.vx * dt;

    const margin = 18;
    if (S.player.x < margin)      { S.player.x = margin;      S.player.vx = 0; }
    if (S.player.x > LW - margin) { S.player.x = LW - margin; S.player.vx = 0; }

    /* spawn timers */
    S.spawnTimer -= dt;
    if (S.spawnTimer <= 0){
      spawnObstacle();
      S.spawnTimer = Math.max(0.28, 0.9 - S.depth * 0.0009);
    }
    S.shardTimer -= dt;
    if (S.shardTimer <= 0){
      spawnShard();
      S.shardTimer = 0.7 + Math.random() * 0.9;
    }

    /* scroll world */
    const v = S.speed;
    for (const o of S.obstacles) o.y += v * dt;
    for (const s of S.shards)    s.y += v * dt;

    /* cull */
    S.obstacles = S.obstacles.filter(o => o.y < LH + 140);
    S.shards    = S.shards.filter(s => s.y < LH + 60 && !s.gone);

    /* obstacle collision */
    const safe = S.invuln > 0 || S.blackout > 0;
    if (!safe){
      for (let i = 0; i < S.obstacles.length; i++){
        const o = S.obstacles[i];
        if (hits(S.player.x, S.player.y, o)){
          S.obstacles.splice(i, 1);
          S.lives--;
          S.invuln  = 1.4;
          S.shake   = 0.45;
          burst(S.player.x, S.player.y, '#ff0033');
          if (S.lives <= 0){ die(); return; }
          break;
        }
      }
    }

    /* shard pickup */
    for (const s of S.shards){
      if (s.gone) continue;
      const dx = s.x - S.player.x;
      const dy = s.y - S.player.y;
      if (dx * dx + dy * dy < 28 * 28){
        s.gone = true;
        S.shardStreak++;
        burst(s.x, s.y, '#00ff41');
        if (S.shardStreak % 10 === 0){
          S.blackout = 0.22;
        }
      }
    }

    /* timers */
    if (S.invuln   > 0) S.invuln   -= dt;
    if (S.blackout > 0) S.blackout -= dt;
    if (S.shake    > 0) S.shake    -= dt;
    if (S.sectorMsgT > 0) S.sectorMsgT -= dt;

    updateHUD();
  }

  /* ── HUD ───────────────────────────────── */
  let lastDepthShown = -1;
  let lastLivesShown = -1;

  function updateHUD(){
    const d = Math.floor(S.depth);
    if (d !== lastDepthShown){
      depthEl.textContent = String(d).padStart(6, '0');
      lastDepthShown = d;
    }
    if (S.lives !== lastLivesShown){
      livesEl.innerHTML = '';
      for (let i = 0; i < S.lives; i++){
        const s = document.createElement('span');
        s.className = 'life';
        s.textContent = '◆';
        livesEl.appendChild(s);
      }
      lastLivesShown = S.lives;
    }
    if (S.sectorMsgT > 0){
      sectorMsgEl.textContent = S.sectorMsgText;
      sectorMsgEl.style.opacity = Math.min(1, S.sectorMsgT);
    } else {
      sectorMsgEl.style.opacity = 0;
    }
  }

  function flashGlitch(){
    glitchEl.classList.remove('on');
    void glitchEl.offsetWidth;
    glitchEl.classList.add('on');
  }

  /* ── DRAW ──────────────────────────────── */
  function draw(){
    /* background base */
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, LW, LH);

    /* green depth glow */
    const g = ctx.createRadialGradient(LW/2, LH*0.8, 20, LW/2, LH*0.8, LH*0.9);
    g.addColorStop(0, 'rgba(0,40,10,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LW, LH);

    /* matrix rain */
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';
    for (const r of S.rain){
      ctx.fillStyle = 'rgba(0,255,65,0.18)';
      ctx.fillText(r.ch, r.x, r.y);
    }

    /* shake */
    let sx = 0, sy = 0;
    if (S.shake > 0){
      const amp = S.shake * 12;
      sx = (Math.random() - 0.5) * amp;
      sy = (Math.random() - 0.5) * amp;
    }

    ctx.save();
    ctx.translate(sx, sy);

    /* shards */
    for (const s of S.shards){
      if (s.gone) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(performance.now() * 0.002 + s.bob);
      ctx.fillStyle = '#00ff41';
      ctx.shadowColor = '#00ff41';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(0, -s.r);
      ctx.lineTo(s.r, 0);
      ctx.lineTo(0, s.r);
      ctx.lineTo(-s.r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    /* obstacles */
    for (const o of S.obstacles) drawObstacle(o);

    /* player */
    if (S.mode === 'playing' || S.mode === 'dead') drawPlayer();

    ctx.restore();

    /* blackout curtain */
    if (S.blackout > 0){
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, LW, LH);
      ctx.strokeStyle = 'rgba(0,255,65,' + Math.min(1, S.blackout * 3) + ')';
      ctx.lineWidth = 2;
      ctx.strokeRect(3, 3, LW - 6, LH - 6);
    }

    /* particles */
    for (const p of S.particles){
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawObstacle(o){
    ctx.save();
    if (o.type === 'block'){
      ctx.fillStyle = 'rgba(255,0,51,0.85)';
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = 16;
      ctx.fillRect(o.x, o.y, o.w, o.h);

      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      for (let y = o.y + 4; y < o.y + o.h; y += 6){
        ctx.beginPath();
        ctx.moveTo(o.x, y);
        ctx.lineTo(o.x + o.w, y);
        ctx.stroke();
      }
      ctx.strokeStyle = '#ff5577';
      ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1);
    } else if (o.type === 'glitch'){
      ctx.fillStyle = 'rgba(255,0,51,0.78)';
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = 16;
      for (let i = 0; i < o.w; i += 8){
        const off = ((performance.now() * 0.05 + o.seed + i) % 8);
        ctx.fillRect(o.x + i, o.y + off, 5, o.h - off);
      }
      ctx.strokeStyle = 'rgba(255,120,140,0.7)';
      ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1);
    } else if (o.type === 'spike'){
      ctx.fillStyle = 'rgba(255,0,51,0.9)';
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = 14;
      const count = Math.max(2, Math.floor(o.w / 16));
      const tw = o.w / count;
      for (let i = 0; i < count; i++){
        ctx.beginPath();
        ctx.moveTo(o.x + i * tw,          o.y + o.h);
        ctx.lineTo(o.x + i * tw + tw / 2, o.y);
        ctx.lineTo(o.x + (i + 1) * tw,    o.y + o.h);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawPlayer(){
    /* invuln flicker */
    if (S.invuln > 0 && Math.floor(S.invuln * 20) % 2 === 0) return;

    const time = performance.now() * 0.003;
    const pulse = 1 + Math.sin(time * 2) * 0.08;

    ctx.save();
    ctx.translate(S.player.x, S.player.y);
    ctx.scale(pulse, pulse);

    ctx.shadowColor = '#00ff41';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#00ff41';

    /* hex rune */
    ctx.beginPath();
    for (let i = 0; i < 6; i++){
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * PLAYER_R;
      const py = Math.sin(a) * PLAYER_R;
      if (i === 0) ctx.moveTo(px, py);
      else         ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    /* inner void */
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#031a08';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    /* direction streak */
    if (Math.abs(S.player.vx) > 30){
      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00ff41';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(S.player.vx > 0 ? 22 : -22, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ── CONTROL ───────────────────────────── */
  function start(){
    S.mode = 'playing';
    S.depth = 0;
    S.speed = BASE_SPEED;
    S.obstacles = [];
    S.shards = [];
    S.particles = [];
    S.lives = 3;
    S.invuln = 0;
    S.blackout = 0;
    S.shardStreak = 0;
    S.spawnTimer = 0.6;
    S.shardTimer = 0.4;
    S.sectorIdx = -1;
    S.sectorMsgT = 0;
    S.shake = 0;
    S.player.x = LW / 2;
    S.player.vx = 0;
    S.keys.left = false;
    S.keys.right = false;
    S.touchDir = 0;
    S.touchActive = false;
    S.deadTime = 0;
    lastDepthShown = -1;
    lastLivesShown = -1;

    titleScreen.classList.remove('active');
    deadScreen.classList.remove('active');
    updateHUD();
  }

  function die(){
    S.mode = 'dead';
    S.deadTime = performance.now();

    const finalDepth = Math.floor(S.depth);
    if (finalDepth > S.best){
      S.best = finalDepth;
      localStorage.setItem('cossy_blackout_best', String(S.best));
    }

    deadMsgEl.textContent   = DEATH_MSGS[Math.floor(Math.random() * DEATH_MSGS.length)];
    deadDepthEl.textContent = String(finalDepth).padStart(6, '0');
    deadBestEl.textContent  = String(S.best).padStart(6, '0');

    deadScreen.classList.add('active');
    flashGlitch();
  }

  function showTitle(){
    S.mode = 'title';
    titleBestEl.textContent = String(S.best).padStart(6, '0');
    titleScreen.classList.add('active');
    deadScreen.classList.remove('active');
  }

  /* ── INPUT: KEYBOARD ───────────────────── */
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') S.keys.left  = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') S.keys.right = true;

    if (e.key === ' ' || e.key === 'Enter'){
      if (S.mode === 'title') start();
      else if (S.mode === 'dead' && performance.now() - S.deadTime > 350) start();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') S.keys.left  = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') S.keys.right = false;
  });

  /* ── INPUT: POINTER / TOUCH ────────────── */
  function pointFromEvent(e){
    const rect = stage.getBoundingClientRect();
    if (e.touches && e.touches.length){
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onDown(e){
    if (e.cancelable) e.preventDefault();

    if (S.mode === 'title'){ start(); return; }
    if (S.mode === 'dead'){
      if (performance.now() - S.deadTime < 350) return;
      start();
      return;
    }
    S.touchActive = true;
    onMove(e);
  }

  function onMove(e){
    if (!S.touchActive || S.mode !== 'playing') return;
    if (e.cancelable) e.preventDefault();
    const p = pointFromEvent(e);
    const dx = p.x - S.player.x;
    if (dx < -6) S.touchDir = -1;
    else if (dx > 6) S.touchDir = 1;
    else S.touchDir = 0;
  }

  function onUp(){
    S.touchActive = false;
    S.touchDir = 0;
  }

  stage.addEventListener('mousedown', onDown);
  stage.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  stage.addEventListener('touchstart', onDown, { passive: false });
  stage.addEventListener('touchmove',  onMove, { passive: false });
  stage.addEventListener('touchend',   onUp);
  stage.addEventListener('touchcancel', onUp);

  /* ── MAIN LOOP ─────────────────────────── */
  function loop(t){
    if (!S.lastT) S.lastT = t;
    let dt = (t - S.lastT) / 1000;
    S.lastT = t;
    dt = Math.min(dt, 0.05);   /* clamp for tab-switch spikes */

    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  /* ── BOOT ──────────────────────────────── */
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 150));

  resize();
  showTitle();
  requestAnimationFrame(loop);

})();
