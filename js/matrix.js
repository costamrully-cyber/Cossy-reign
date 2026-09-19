/* Matrix-style code rain — neon green, real-time */
(function(){
  const canvas = document.getElementById('rain');
  const ctx    = canvas.getContext('2d');

  let W, H, cols, drops;
  const GLYPHS = 'アカサタナハマヤラワ0123456789ABCDEF<>/\\{}[]$#%&*+=';
  const FONT   = 16;

  function resize(){
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    cols = Math.floor(W / FONT);
    drops = new Array(cols).fill(1).map(() => Math.random() * H);
  }

  function draw(){
    /* fade trail */
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0,0,W,H);

    ctx.font = FONT + 'px monospace';

    for(let i=0;i<cols;i++){
      const ch = GLYPHS[Math.floor(Math.random()*GLYPHS.length)];
      const x  = i * FONT;
      const y  = drops[i];

      /* bright head */
      ctx.fillStyle = '#c8ffd4';
      ctx.shadowColor = '#00ff41';
      ctx.shadowBlur  = 10;
      ctx.fillText(ch, x, y);

      /* dim tail */
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,255,65,0.55)';
      ctx.fillText(ch, x, y - FONT);

      drops[i] += FONT * 0.7;
      if (drops[i] > H && Math.random() > 0.975) drops[i] = 0;
    }
  }

  window.addEventListener('resize', resize);
  resize();
  setInterval(draw, 45);
})();
