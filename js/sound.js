/* ══════════════════════════════════════════════
   COSSY REIGN — ambient sound controller
   · Autoplays muted instantly
   · Unmutes on first click / tap / keypress
   · Toggle button for manual on/off
   · Remembers user's choice
   ══════════════════════════════════════════════ */

(function(){
  const audio  = document.getElementById('ambient');
  const toggle = document.getElementById('soundToggle');
  if (!audio || !toggle) return;

  const STORAGE_KEY = 'cossy_sound_on';
  let userPaused = false;

  /* Volume (0.0 – 1.0). 0.35 = background hum. 0.6 = bolder. */
  audio.volume = 0.35;

  function setPlaying(on){
    audio.muted = !on;
    toggle.classList.toggle('playing', on);
    if (on) toggle.classList.remove('needs-tap');
  }

  /* ── Attempt silent autoplay immediately ── */
  function attemptAutoplay(){
    audio.muted = true;
    const p = audio.play();

    if (p && p.then){
      p.then(() => {
        /* muted playback started → try to unmute after 250ms */
        setTimeout(() => {
          if (!userPaused && localStorage.getItem(STORAGE_KEY) !== 'off'){
            audio.muted = false;
            setPlaying(true);
          } else {
            setPlaying(false);
          }
        }, 250);
      }).catch(() => {
        /* Browser refused → pulse the toggle so user taps */
        toggle.classList.add('needs-tap');
        setPlaying(false);
      });
    }
  }

  /* ── Unlock on first user interaction anywhere ── */
  function unlock(){
    if (userPaused) return;
    if (localStorage.getItem(STORAGE_KEY) === 'off') return;

    audio.muted = false;
    const p = audio.play();
    if (p && p.then){
      p.then(() => {
        setPlaying(true);
        localStorage.setItem(STORAGE_KEY, 'on');
        document.removeEventListener('click',      unlock);
        document.removeEventListener('touchstart', unlock);
        document.removeEventListener('keydown',    unlock);
        document.removeEventListener('scroll',     unlock);
      }).catch(() => {});
    }
  }

  document.addEventListener('click',      unlock);
  document.addEventListener('touchstart', unlock, { passive: true });
  document.addEventListener('keydown',    unlock);
  document.addEventListener('scroll',     unlock, { passive: true });

  /* ── Manual toggle button ── */
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (audio.muted || audio.paused){
      userPaused = false;
      audio.muted = false;
      audio.play().then(() => {
        setPlaying(true);
        localStorage.setItem(STORAGE_KEY, 'on');
      }).catch(() => {});
    } else {
      userPaused = true;
      audio.pause();
      setPlaying(false);
      localStorage.setItem(STORAGE_KEY, 'off');
    }
  });

  /* ── Respect prior mute choice ── */
  if (localStorage.getItem(STORAGE_KEY) === 'off'){
    userPaused = true;
    setPlaying(false);
    return;
  }

  /* ── Kick it off ── */
  attemptAutoplay();

  /* ── Keep icon state in sync ── */
  audio.addEventListener('play',  () => toggle.classList.toggle('playing', !audio.muted));
  audio.addEventListener('pause', () => toggle.classList.remove('playing'));
})();
