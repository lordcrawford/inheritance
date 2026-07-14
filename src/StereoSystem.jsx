import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import CDViewer from './CDViewer';

const TRACKS = [
  { label: 'TRACK 01', title: 'Inheritance', src: '/audio/track01.wav' },
  { label: 'TRACK 02', title: 'Track 02',    src: '/audio/track02.wav' },
  { label: 'TRACK 03', title: 'Track 03',    src: '/audio/track03.wav' },
];

function fmt(s) {
  if (!isFinite(s) || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

function drawWood(canvas, w, h, seed, numLines = 55) {
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  // Rich base gradient
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0,    '#8a5a2c');
  base.addColorStop(0.15, '#9e6a34');
  base.addColorStop(0.3,  '#7a4820');
  base.addColorStop(0.5,  '#9a6030');
  base.addColorStop(0.7,  '#8a5228');
  base.addColorStop(0.85, '#7c4620');
  base.addColorStop(1,    '#6e3e18');
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);

  // Primary grain lines — more visible
  ctx.save(); ctx.globalAlpha = 0.42;
  for (let i = 0; i < numLines; i++) {
    const y = (i / numLines) * h + ((seed * 3 + i * 13) % 9) - 4;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 2) {
      ctx.lineTo(x, y
        + Math.sin(x * 0.025 + i * 0.45 + seed) * 4
        + Math.sin(x * 0.07 + i * 0.9) * 2
        + Math.sin(x * 0.18 + i) * 0.8);
    }
    ctx.strokeStyle = i % 6 === 0 ? '#2e1004' : (i % 3 === 0 ? '#4a2008' : '#aa7040');
    ctx.lineWidth = i % 6 === 0 ? 2 : (i % 3 === 0 ? 1.2 : 0.7);
    ctx.stroke();
  }
  ctx.restore();

  // Dark knot
  ctx.save(); ctx.globalAlpha = 0.22;
  const kx = w * 0.62, ky = h * 0.38;
  for (let r = 20; r > 0; r -= 2.5) {
    ctx.beginPath();
    ctx.ellipse(kx, ky, r * 1.5, r * 0.65, 0.35, 0, Math.PI * 2);
    ctx.strokeStyle = '#2e1004'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();

  // Highlight sheen along the left edge
  const sheen = ctx.createLinearGradient(0, 0, w, 0);
  sheen.addColorStop(0,   'rgba(255,210,140,0.18)');
  sheen.addColorStop(0.3, 'rgba(255,210,140,0.06)');
  sheen.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = sheen; ctx.fillRect(0, 0, w, h);

  // Subtle dark vignette on edges
  const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w,h) * 0.3, w * 0.5, h * 0.5, Math.max(w,h) * 0.85);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h);
}

const TOOLTIP_SECTIONS = [
  null,
  {
    title: 'Intro',
    points: [
      'During covid, I took a lot of walks by the rocks of riverside drive (out of boredom). At night, I could hear the waves and it was always pretty calming. It was also a time where I could reflect and journal in peace.',
      'This intro represents change during a time when I first saw myself as a creative.',
    ],
  },
  {
    title: 'Sound 2',
    points: [
      'During covid (again) was when my music taste suddenly exploded. Prior to this, I had only really listened to hip-hop and r&b (amazing genres btw).',
      { text: 'This beat was inspired by…', sub: [
        'Singeli (Tanzanian high-speed electronic music) :D — particularly DJ Travella',
        'Hyperpop — particularly PC Music (ag cook)',
        'Indie (so many artists lol)',
        'Recently, more Brazilian music (I took a trip to rio last year)',
      ]},
    ],
  },
  {
    title: 'Sound 3',
    points: [
      "Despite these previous songs and what I might say, the chunk of my music listening is this genre ‘rage trap’ — likely 70% of my listening history.",
      "I can’t even say it’s my favorite but there’s something hyper-addictive about it.",
      'For me, it represents a clash of hip-hop (the 808s, rap, samples) and other genres. The more typical genre mashup would be with punk, rock, hyper pop, and some artists have been exploring metal.',
      { text: 'Artist/producer inspo', sub: ['F1lthy', 'SoFaygo'] },
    ],
  },
];

export default function StereoSystem() {
  const [inserted,  setInserted]  = useState(false);
  const [cdPhase,   setCdPhase]   = useState('floating');
  const [playing,   setPlaying]   = useState(false);
  const [trackIdx,  setTrackIdx]  = useState(0);
  const [volume,    setVolume]    = useState(1.0);
  const [xfadeOn,   setXfadeOn]   = useState(false);
  const [xfadeTime, setXfadeTime] = useState(4);
  const [tooltipIdx, setTooltipIdx] = useState(0);
  const [scaleLayout, setScaleLayout] = useState({ scale: 1, height: 0 });

  // DOM refs
  const scaleContainerRef = useRef(null);
  const scaleContentRef   = useRef(null);
  const tooltipBoxRef     = useRef(null);
  const tooltipDotRef     = useRef(null);
  const trayRef         = useRef(null);
  const spinCDRef       = useRef(null);
  const deckTextRef     = useRef(null);
  const ampLedRef       = useRef(null);
  const barsRef         = useRef(null);
  const woodLRef        = useRef(null);
  const woodRackRef     = useRef(null);
  const woodRRef        = useRef(null);
  const progressInputRef = useRef(null);
  const progressFillRef  = useRef(null);
  const progressTimeRef  = useRef(null);
  const volKnobRef       = useRef(null);
  const xfadKnobRef      = useRef(null);
  const volValueRef      = useRef(null);
  const xfadValueRef     = useRef(null);

  // Mutable state
  const insertedRef   = useRef(false);
  const playingRef    = useRef(false);
  const trackRef      = useRef(0);
  const volumeRef     = useRef(1.0);
  const xfadeRef      = useRef({ on: false, time: 4 });
  const audioARef     = useRef(null);
  const audioBRef     = useRef(null);
  const activeRef     = useRef('a');
  const xfadeIntRef      = useRef(null);
  const xfadeTimeoutRef  = useRef(null);
  const isCrossfadingRef = useRef(false);
  const isSeekingRef     = useRef(false);
  const rafPlayRef    = useRef(null);
  const audioCtxRef   = useRef(null);
  const analyserRef   = useRef(null);
  const gainARef      = useRef(null);
  const gainBRef      = useRef(null);
  const freqDataRef   = useRef(null);

  const getActive       = () => activeRef.current === 'a' ? audioARef.current : audioBRef.current;
  const getInactive     = () => activeRef.current === 'a' ? audioBRef.current : audioARef.current;
  const getActiveGain   = () => activeRef.current === 'a' ? gainARef.current  : gainBRef.current;
  const getInactiveGain = () => activeRef.current === 'a' ? gainBRef.current  : gainARef.current;

  useEffect(() => {
    if (volKnobRef.current)  volKnobRef.current.style.transform  = `rotate(${(volumeRef.current * 270) - 135}deg)`;
    if (xfadKnobRef.current) xfadKnobRef.current.style.transform = `rotate(${((xfadeRef.current.time - 0.5) / 9.5) * 270 - 135}deg)`;
  }, []);

  useLayoutEffect(() => {
    function updateScale() {
      const container = scaleContainerRef.current, content = scaleContentRef.current;
      if (!container || !content) return;
      const containerWidth = container.offsetWidth;
      const naturalWidth = content.offsetWidth;
      const naturalHeight = content.offsetHeight;
      if (naturalWidth > 0) {
        const scale = containerWidth / naturalWidth;
        const height = naturalHeight * scale;
        setScaleLayout(prev => (prev.scale === scale && prev.height === height) ? prev : { scale, height });
      }
    }
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (scaleContainerRef.current) ro.observe(scaleContainerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (woodLRef.current)    drawWood(woodLRef.current,    110, 360, 0.5, 55);
    if (woodRackRef.current) drawWood(woodRackRef.current, 812, 350, 2.2, 80);
    if (woodRRef.current)    drawWood(woodRRef.current,    110, 360, 3.9, 55);
  }, []);

  useEffect(() => {
    const a = new Audio(TRACKS[0].src);
    const b = new Audio();
    a.volume = volumeRef.current; b.volume = 0;
    audioARef.current = a; audioBRef.current = b;
    function onEnded() {
      if (isCrossfadingRef.current) return;
      switchTrack((trackRef.current + 1) % TRACKS.length, true);
    }
    a.addEventListener('ended', onEnded);
    b.addEventListener('ended', onEnded);
    return () => { a.pause(); b.pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const EQ_BINS    = [1, 2, 4, 7, 11, 18, 28, 38, 52];
  const EQ_DEFAULT = [8, 17, 25, 20, 11, 22, 6, 13, 8];

  function startPlaybackLoop() {
    cancelAnimationFrame(rafPlayRef.current);
    function loop() {
      rafPlayRef.current = requestAnimationFrame(loop);
      const an = analyserRef.current, fd = freqDataRef.current, bars = barsRef.current?.children;
      if (an && fd && bars) {
        an.getByteFrequencyData(fd);
        Array.from(bars).forEach((b, i) => { b.style.height = `${6 + (fd[EQ_BINS[i]] / 255) * 28}px`; });
      }
      const audio = getActive();
      if (audio && !isSeekingRef.current) {
        const t = audio.currentTime || 0;
        const dur = isFinite(audio.duration) ? audio.duration : 0;
        if (progressInputRef.current) { progressInputRef.current.max = dur || 100; progressInputRef.current.value = t; }
        if (progressFillRef.current) progressFillRef.current.style.width = dur > 0 ? `${(t / dur) * 100}%` : '0%';
        if (progressTimeRef.current) progressTimeRef.current.textContent = `${fmt(t)} / ${fmt(dur)}`;
      }
    }
    loop();
  }

  function stopPlaybackLoop() {
    cancelAnimationFrame(rafPlayRef.current);
    const bars = barsRef.current?.children;
    if (bars) Array.from(bars).forEach((b, i) => { b.style.height = EQ_DEFAULT[i] + 'px'; });
  }

  function setLED(color, glow = false) {
    if (!ampLedRef.current) return;
    ampLedRef.current.style.background = color;
    ampLedRef.current.style.boxShadow  = glow ? `0 0 6px ${color}` : 'none';
  }

  function resetProgress() {
    if (progressFillRef.current)  progressFillRef.current.style.width = '0%';
    if (progressTimeRef.current)  progressTimeRef.current.textContent = '0:00 / 0:00';
    if (progressInputRef.current) { progressInputRef.current.value = 0; progressInputRef.current.max = 100; }
  }

  function switchTrack(newIdx, autoAdvance = false) {
    const wasPlaying = playingRef.current || autoAdvance;
    const active = getActive(), inactive = getInactive();
    const xOn = xfadeRef.current.on, xTime = xfadeRef.current.time;
    const ctx = audioCtxRef.current;
    clearInterval(xfadeIntRef.current);
    clearTimeout(xfadeTimeoutRef.current);
    isCrossfadingRef.current = false;

    if (xOn && wasPlaying && xTime > 0) {
      isCrossfadingRef.current = true;
      inactive.src = TRACKS[newIdx].src;
      inactive.play().catch(() => {});
      if (ctx) {
        const fg = getActiveGain(), tg = getInactiveGain(), now = ctx.currentTime;
        fg.gain.cancelScheduledValues(now); fg.gain.setValueAtTime(volumeRef.current, now); fg.gain.linearRampToValueAtTime(0, now + xTime);
        tg.gain.cancelScheduledValues(now); tg.gain.setValueAtTime(0, now); tg.gain.linearRampToValueAtTime(volumeRef.current, now + xTime);
        xfadeTimeoutRef.current = setTimeout(() => {
          active.pause();
          fg.gain.setValueAtTime(volumeRef.current, audioCtxRef.current?.currentTime ?? 0);
          activeRef.current = activeRef.current === 'a' ? 'b' : 'a';
          isCrossfadingRef.current = false;
        }, xTime * 1000);
      } else {
        inactive.volume = 0;
        const steps = Math.max(10, Math.round(xTime * 60)), interval = (xTime * 1000) / steps;
        let step = 0;
        xfadeIntRef.current = setInterval(() => {
          step++;
          const t = step / steps;
          active.volume = Math.max(0, (1 - t) * volumeRef.current);
          inactive.volume = Math.min(1, t) * volumeRef.current;
          if (step >= steps) {
            clearInterval(xfadeIntRef.current);
            active.pause(); active.volume = volumeRef.current;
            activeRef.current = activeRef.current === 'a' ? 'b' : 'a';
            isCrossfadingRef.current = false;
          }
        }, interval);
      }
    } else {
      active.pause();
      active.src = TRACKS[newIdx].src;
      if (ctx) getActiveGain().gain.value = volumeRef.current; else active.volume = volumeRef.current;
      if (wasPlaying) { active.play().catch(() => {}); if (!playingRef.current) { playingRef.current = true; setPlaying(true); } }
    }

    trackRef.current = newIdx; setTrackIdx(newIdx); resetProgress();
    if (deckTextRef.current) deckTextRef.current.textContent = wasPlaying ? '▶ PLAY' : TRACKS[newIdx].label;
    if (spinCDRef.current) { spinCDRef.current.style.opacity = wasPlaying ? '1' : '0'; spinCDRef.current.style.animation = wasPlaying ? 'spin 1.8s linear infinite' : 'none'; }
  }

  function triggerInsert() {
    if (insertedRef.current) return;
    insertedRef.current = true;
    setInserted(true);

    // Init Web Audio on user gesture
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const an = ctx.createAnalyser();
      an.fftSize = 128; an.smoothingTimeConstant = 0.75;
      analyserRef.current = an; freqDataRef.current = new Uint8Array(an.frequencyBinCount);
      const gA = ctx.createGain(); gA.gain.value = volumeRef.current;
      const gB = ctx.createGain(); gB.gain.value = 0;
      gainARef.current = gA; gainBRef.current = gB;
      ctx.createMediaElementSource(audioARef.current).connect(gA);
      ctx.createMediaElementSource(audioBRef.current).connect(gB);
      gA.connect(an); gB.connect(an); an.connect(ctx.destination);
    } catch (e) { console.warn('Web Audio unavailable:', e); }

    if (trayRef.current) trayRef.current.style.transform = 'translateX(72px)';
    if (deckTextRef.current) deckTextRef.current.textContent = 'LOADING';

    setTimeout(() => setCdPhase('inserting'), 80);

    setTimeout(() => { if (trayRef.current) trayRef.current.style.transform = 'translateX(0)'; setLED('#ff4400'); }, 1200);
    setTimeout(() => { if (deckTextRef.current) deckTextRef.current.textContent = TRACKS[trackRef.current].label; }, 1700);
  }

  function handlePlay() {
    if (!insertedRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx?.state === 'suspended') ctx.resume();
    getActive().play().catch(() => {});
    playingRef.current = true; setPlaying(true);
    if (spinCDRef.current) { spinCDRef.current.style.opacity = '1'; spinCDRef.current.style.animation = 'spin 1.8s linear infinite'; }
    if (deckTextRef.current) deckTextRef.current.textContent = '▶ PLAY';
    setLED('#00ff44', true);
    startPlaybackLoop();
  }

  function handlePause() {
    if (!insertedRef.current) return;
    clearInterval(xfadeIntRef.current);
    getActive().pause(); getInactive().pause();
    playingRef.current = false; setPlaying(false);
    if (spinCDRef.current) { spinCDRef.current.style.opacity = '0'; spinCDRef.current.style.animation = 'none'; }
    if (deckTextRef.current) deckTextRef.current.textContent = TRACKS[trackRef.current].label;
    setLED('#ff4400');
    stopPlaybackLoop();
  }

  function handleLast() { switchTrack((trackIdx - 1 + TRACKS.length) % TRACKS.length); }
  function handleNext() { switchTrack((trackIdx + 1) % TRACKS.length); }

  function handleEject() {
    if (!insertedRef.current) return;
    clearInterval(xfadeIntRef.current);
    clearTimeout(xfadeTimeoutRef.current);
    getActive().pause(); getInactive().pause();
    playingRef.current = false; setPlaying(false);
    stopPlaybackLoop(); resetProgress();
    if (spinCDRef.current) { spinCDRef.current.style.opacity = '0'; spinCDRef.current.style.animation = 'none'; }
    if (trayRef.current) trayRef.current.style.transform = 'translateX(72px)';
    if (deckTextRef.current) deckTextRef.current.textContent = 'EJECT';
    setLED('#cc4400');
    setTimeout(() => {
      if (trayRef.current) trayRef.current.style.transform = 'translateX(0)';
      if (deckTextRef.current) deckTextRef.current.textContent = 'NO DISC';
      getActive().src = TRACKS[0].src;
      trackRef.current = 0; setTrackIdx(0);
      insertedRef.current = false; setInserted(false);
      setCdPhase('floating');
    }, 1400);
  }

  function handleVolKnobMouseDown(e) {
    e.preventDefault();
    const startY = e.clientY, startVal = volumeRef.current;
    function onMove(me) {
      const v = Math.max(0, Math.min(1, startVal + (startY - me.clientY) / 150));
      volumeRef.current = v; setVolume(v);
      if (volKnobRef.current)  volKnobRef.current.style.transform  = `rotate(${(v * 270) - 135}deg)`;
      if (volValueRef.current) volValueRef.current.textContent = String(Math.round(v * 100));
      const g = activeRef.current === 'a' ? gainARef.current : gainBRef.current;
      if (g) g.gain.value = v;
      else { const a = activeRef.current === 'a' ? audioARef.current : audioBRef.current; if (a) a.volume = v; }
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleXfadKnobMouseDown(e) {
    e.preventDefault();
    const startY = e.clientY, startVal = xfadeRef.current.time;
    function onMove(me) {
      const raw = Math.max(0.5, Math.min(10, startVal + (startY - me.clientY) / 12));
      const t = Math.round(raw * 2) / 2;
      xfadeRef.current.time = t; setXfadeTime(t);
      if (xfadKnobRef.current)  xfadKnobRef.current.style.transform  = `rotate(${((t - 0.5) / 9.5) * 270 - 135}deg)`;
      if (xfadValueRef.current) xfadValueRef.current.textContent = t.toFixed(1) + 's';
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleVolume(e) {
    const v = parseFloat(e.target.value);
    setVolume(v); volumeRef.current = v;
    if (volKnobRef.current) volKnobRef.current.style.transform = `rotate(${(v * 270) - 135}deg)`;
    const g = getActiveGain();
    if (g) g.gain.value = v; else getActive().volume = v;
  }

  function handleXfadeToggle(e) { const on = e.target.checked; setXfadeOn(on); xfadeRef.current.on = on; }
  function handleXfadeTime(e)   {
    const t = parseFloat(e.target.value); setXfadeTime(t); xfadeRef.current.time = t;
    if (xfadKnobRef.current) xfadKnobRef.current.style.transform = `rotate(${((t - 0.5) / 9.5) * 270 - 135}deg)`;
  }

  function handleProgressMouseDown() { isSeekingRef.current = true; }
  function handleProgressChange(e) {
    const t = parseFloat(e.target.value), audio = getActive();
    if (audio && isFinite(audio.duration)) {
      audio.currentTime = t;
      if (progressFillRef.current) progressFillRef.current.style.width = `${(t / audio.duration) * 100}%`;
      if (progressTimeRef.current) progressTimeRef.current.textContent = `${fmt(t)} / ${fmt(audio.duration)}`;
    }
  }
  function handleProgressMouseUp() { isSeekingRef.current = false; }

  function nextTooltip() { setTooltipIdx(prev => prev === 3 ? 1 : prev + 1); }
  function prevTooltip() { setTooltipIdx(prev => prev === 0 ? 3 : (prev === 1 ? 3 : prev - 1)); }

  useEffect(() => {
    if (tooltipIdx === 0) return;
    function onKey(e) {
      if (e.key === 'ArrowRight') nextTooltip();
      else if (e.key === 'ArrowLeft') prevTooltip();
      else if (e.key === 'Escape') setTooltipIdx(0);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tooltipIdx]);

  useEffect(() => {
    if (tooltipIdx === 0) return;
    function onPointerDown(e) {
      if (tooltipBoxRef.current?.contains(e.target)) return;
      if (tooltipDotRef.current?.contains(e.target)) return;
      setTooltipIdx(0);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [tooltipIdx]);

  const track = TRACKS[trackIdx];

  return (
    <>
    <div ref={scaleContainerRef} style={{ width: '80%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflow: 'hidden', height: scaleLayout.height || undefined }}>
    <div ref={scaleContentRef} style={{ fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '48px', padding: '32px 0 40px', minHeight: '600px', flexShrink: 0, transform: `scale(${scaleLayout.scale})`, transformOrigin: 'top center' }}>

      {/* CD — 3D model, click to insert */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <CDViewer
          phase={cdPhase}
          onClick={triggerInsert}
          onInsertDone={() => setCdPhase('inserted')}
        />
        {!inserted && (
          <div style={{ fontFamily: 'cursive', fontSize: '14px', color: '#888' }}>click cd to insert</div>
        )}
      </div>

      {/* Speakers + Rack */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

        {/* Left speaker */}
        <div style={{ width: '110px', height: '360px', borderRadius: '6px', border: '2px solid rgba(120,70,30,0.8)', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
          <canvas ref={woodLRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }} />
          <div style={{ position: 'absolute', top: '55%', left: 0, right: 0, bottom: 0, zIndex: 1, background: '#0a0a0a' }} />
          {/* Glass sheen on speaker */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5, background: 'linear-gradient(160deg,rgba(255,255,255,0.08) 0%,rgba(255,255,255,0.01) 40%,rgba(0,0,0,0) 100%)', pointerEvents: 'none', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)' }} />
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'radial-gradient(circle,#888 30%,#333 100%)', border: '2px solid #222', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }} />
            <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'radial-gradient(circle,#555 20%,#222 60%,#111 100%)', border: '4px solid #1a1a1a', boxShadow: '0 4px 12px rgba(0,0,0,0.7)' }} />
            <div style={{ width: '64px', height: '10px', background: '#111', borderRadius: '4px', border: '1px solid #222' }} />
          </div>
        </div>

        {/* Rack */}
        <div style={{ width: '780px', borderRadius: '6px', border: '2px solid rgba(120,70,30,0.8)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.7)' }}>
          {/* Wood canvas — covers all visible areas including gaps */}
          <canvas ref={woodRackRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }} />

          {/* Rack units */}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* FM tuner */}
            <div style={{ background: '#1e1e1e', borderRadius: '3px', border: '1px solid #333', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '11px', height: '40px' }}>
              <div style={{ flex: 1, height: '24px', background: '#001a2a', border: '1px solid #003344', borderRadius: '2px', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                <span style={{ fontSize: '12px', color: '#00aaff', fontFamily: 'monospace' }}>FM 101.1 MHz</span>
              </div>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%,#666,#222)', border: '1px solid #444' }} />
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%,#666,#222)', border: '1px solid #444' }} />
            </div>
            {/* Tape slot */}
            <div style={{ background: '#1e1e1e', borderRadius: '3px', border: '1px solid #333', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '11px', height: '40px' }}>
              <div style={{ flex: 1, height: '20px', background: '#111', border: '1px solid #333', borderRadius: '2px' }} />
              <div style={{ width: '16px', height: '16px', borderRadius: '3px', background: '#333', border: '1px solid #555' }} />
              <div style={{ width: '16px', height: '16px', borderRadius: '3px', background: '#333', border: '1px solid #555' }} />
            </div>
            {/* EQ / Amp */}
            <div style={{ background: '#1e1e1e', borderRadius: '3px', border: '1px solid #333', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px', height: '60px' }}>
              <div ref={barsRef} style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '34px', flexShrink: 0 }}>
                {EQ_DEFAULT.map((h, i) => (
                  <div key={i} style={{ width: '6px', height: `${h}px`, background: '#00cc44', borderRadius: '1px' }} />
                ))}
              </div>
              <div ref={ampLedRef} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cc4400', border: '1px solid #aa3300', flexShrink: 0 }} />
              {/* Timeline */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span ref={progressTimeRef} style={{ fontSize: '11px', color: '#00cc44', fontFamily: 'monospace', textAlign: 'center', letterSpacing: '0.04em' }}>0:00 / 0:00</span>
                <div style={{ position: 'relative', height: '20px', display: 'flex', alignItems: 'center' }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, height: '4px', background: '#2a2a2a', borderRadius: '2px', border: '1px solid #333' }}>
                    <div ref={progressFillRef} style={{ height: '100%', width: '0%', background: 'linear-gradient(90deg,#003300,#00cc44)', borderRadius: '2px', position: 'relative' }}>
                      <div style={{ position: 'absolute', right: '-5px', top: '-5px', width: '14px', height: '14px', background: '#00cc44', borderRadius: '50%', boxShadow: '0 0 3px #00cc44', pointerEvents: 'none' }} />
                    </div>
                  </div>
                  <input ref={progressInputRef} type="range" min="0" max="100" step="0.1" defaultValue="0"
                    onMouseDown={handleProgressMouseDown} onChange={handleProgressChange} onMouseUp={handleProgressMouseUp} onTouchEnd={handleProgressMouseUp}
                    disabled={!inserted}
                    style={{ position: 'absolute', left: 0, right: 0, width: '100%', opacity: 0, cursor: inserted ? 'pointer' : 'default', zIndex: 1, margin: 0, height: '20px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%,#777,#222)', border: '1px solid #555' }} />)}
              </div>
            </div>
            {/* CD deck */}
            <div style={{ background: '#1e1e1e', borderRadius: '3px', border: '1px solid #333', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '11px', height: '44px' }}>
              <span style={{ fontSize: '11px', color: '#888' }}>CD</span>
              <div style={{ flex: 1, height: '25px', background: '#111', border: '1px solid #333', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
                <div ref={trayRef} style={{ position: 'absolute', top: '1px', left: '2px', height: '23px', width: '112px', background: '#2a2a2a', borderRadius: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.65s cubic-bezier(0.4,0,0.2,1)' }}>
                  <span style={{ fontSize: '10px', color: '#555', fontFamily: 'monospace' }}>· · ·</span>
                </div>
                <div style={{ position: 'absolute', right: '4px', top: '2px', width: '22px', height: '22px', borderRadius: '50%', background: '#0a0a0a', border: '1px solid #333', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div ref={spinCDRef} style={{ width: '17px', height: '17px', borderRadius: '50%', background: 'conic-gradient(#ccc 0deg,#f99 90deg,#9cf 200deg,#ccc 360deg)', opacity: 0, transition: 'opacity 0.4s' }} />
                </div>
              </div>
              <div style={{ width: '90px', height: '25px', background: '#001800', border: '1px solid #003300', borderRadius: '2px', display: 'flex', alignItems: 'center', padding: '0 7px' }}>
                <span ref={deckTextRef} style={{ fontSize: '11px', color: '#00cc44', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>NO DISC</span>
              </div>
              <button onClick={handleEject} disabled={!inserted} className="transport-btn"
                style={{ padding: '3px 8px', fontSize: '13px', borderRadius: '2px', border: '1px solid #444', background: '#2a2a2a', color: inserted ? '#aaa' : '#444', cursor: inserted ? 'pointer' : 'default', lineHeight: 1 }}>⏏</button>
            </div>
            {/* Controls row */}
            <div style={{ background: '#1e1e1e', borderRadius: '3px', border: '1px solid #333', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '16px' }}>

              {/* VOL knob group */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <div
                  ref={volKnobRef}
                  onMouseDown={handleVolKnobMouseDown}
                  style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%,#777,#444 50%,#1a1a1a 100%)', border: '2px solid #555', boxShadow: '0 2px 6px rgba(0,0,0,0.5)', position: 'relative', cursor: 'ns-resize', flexShrink: 0 }}
                >
                  <div style={{ position: 'absolute', top: '4px', left: '50%', transform: 'translateX(-50%)', width: '3px', height: '11px', background: '#00cc44', borderRadius: '1px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  <span style={{ fontSize: '10px', color: '#555', fontFamily: 'monospace', lineHeight: 1 }}>VOL</span>
                  <span ref={volValueRef} style={{ fontSize: '11px', color: '#00cc44', fontFamily: 'monospace', lineHeight: 1 }}>{Math.round(volume * 100)}</span>
                </div>
              </div>

              {/* XFD knob group */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <div
                  ref={xfadKnobRef}
                  onMouseDown={handleXfadKnobMouseDown}
                  style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%,#666,#333 50%,#1a1a1a 100%)', border: `2px solid ${xfadeOn ? '#555' : '#333'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.5)', position: 'relative', cursor: 'ns-resize', opacity: xfadeOn ? 1 : 0.55, flexShrink: 0 }}
                >
                  <div style={{ position: 'absolute', top: '3px', left: '50%', transform: 'translateX(-50%)', width: '3px', height: '9px', background: xfadeOn ? '#00cc44' : '#555', borderRadius: '1px' }} />
                </div>
                <div
                  onClick={() => { const on = !xfadeOn; setXfadeOn(on); xfadeRef.current.on = on; }}
                  style={{ width: '9px', height: '9px', borderRadius: '50%', background: xfadeOn ? '#00cc44' : '#333', border: `1px solid ${xfadeOn ? '#00cc44' : '#555'}`, cursor: 'pointer', boxShadow: xfadeOn ? '0 0 3px #00cc44' : 'none', flexShrink: 0 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  <span style={{ fontSize: '10px', color: '#555', fontFamily: 'monospace', lineHeight: 1 }}>XFD</span>
                  <span ref={xfadValueRef} style={{ fontSize: '11px', color: xfadeOn ? '#00cc44' : '#666', fontFamily: 'monospace', lineHeight: 1 }}>{xfadeTime.toFixed(1)}s</span>
                </div>
              </div>

              <div style={{ flex: 1 }} />

              {/* Transport */}
              <div style={{ display: 'flex', gap: '11px', alignItems: 'center', flexShrink: 0 }}>
                <button onClick={handleLast} disabled={!inserted} className="transport-btn"
                  style={{ padding: '11px 22px', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', borderRadius: '3px', border: '1px solid #444', background: '#2a2a2a', color: inserted ? '#ccc' : '#444', cursor: inserted ? 'pointer' : 'default' }}>◀◀</button>
                <button onClick={handlePlay} disabled={!inserted || playing} className="transport-btn"
                  style={{ padding: '11px 28px', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', borderRadius: '3px', border: `1px solid ${playing ? '#00cc44' : '#444'}`, background: playing ? '#002200' : '#2a2a2a', color: playing ? '#00cc44' : (inserted ? '#ccc' : '#444'), cursor: (inserted && !playing) ? 'pointer' : 'default' }}>▶</button>
                <button onClick={handlePause} disabled={!inserted || !playing} className="transport-btn"
                  style={{ padding: '11px 28px', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', borderRadius: '3px', border: `1px solid ${(inserted && !playing) ? '#cc4400' : '#444'}`, background: (inserted && !playing) ? '#220000' : '#2a2a2a', color: (inserted && !playing) ? '#cc4400' : ((inserted && playing) ? '#ccc' : '#444'), cursor: (inserted && playing) ? 'pointer' : 'default' }}>⏸</button>
                <button onClick={handleNext} disabled={!inserted} className="transport-btn"
                  style={{ padding: '11px 22px', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', borderRadius: '3px', border: '1px solid #444', background: '#2a2a2a', color: inserted ? '#ccc' : '#444', cursor: inserted ? 'pointer' : 'default' }}>▶▶</button>
              </div>
            </div>
          </div>

          {/* Glass overlay on rack — top-most, pointer-events none */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 10, borderRadius: '5px', pointerEvents: 'none',
            background: 'linear-gradient(150deg,rgba(255,255,255,0.09) 0%,rgba(255,255,255,0.02) 35%,rgba(0,0,0,0) 65%,rgba(0,0,0,0.06) 100%)',
            border: '1px solid rgba(255,255,255,0.13)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.35), inset 1px 0 0 rgba(255,255,255,0.08)',
          }} />
        </div>

        {/* Right speaker */}
        <div style={{ width: '110px', height: '360px', borderRadius: '6px', border: '2px solid rgba(120,70,30,0.8)', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
          <canvas ref={woodRRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }} />
          <div style={{ position: 'absolute', top: '55%', left: 0, right: 0, bottom: 0, zIndex: 1, background: '#0a0a0a' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5, background: 'linear-gradient(160deg,rgba(255,255,255,0.08) 0%,rgba(255,255,255,0.01) 40%,rgba(0,0,0,0) 100%)', pointerEvents: 'none', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)' }} />
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'radial-gradient(circle,#888 30%,#333 100%)', border: '2px solid #222', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }} />
            <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'radial-gradient(circle,#555 20%,#222 60%,#111 100%)', border: '4px solid #1a1a1a', boxShadow: '0 4px 12px rgba(0,0,0,0.7)' }} />
            <div style={{ width: '64px', height: '10px', background: '#111', borderRadius: '4px', border: '1px solid #222' }} />
          </div>
        </div>
      </div>

    </div>
    </div>

    {/* Tooltip overlay — fixed to viewport, outside transformed ancestor */}
    <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', pointerEvents: 'none' }}>
      <div
        ref={tooltipDotRef}
        onClick={() => setTooltipIdx(prev => prev === 0 ? 1 : 0)}
        style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#111', border: '1px solid #3a3a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#555', fontSize: tooltipIdx > 0 ? '12px' : '10px', fontFamily: 'monospace', userSelect: 'none', pointerEvents: 'auto' }}
      >
        {tooltipIdx > 0 ? '×' : '·'}
      </div>
      {tooltipIdx > 0 && (
        <div
          ref={tooltipBoxRef}
          style={{ position: 'relative', fontFamily: '"Courier New", Courier, monospace', fontSize: '14px', color: '#fff', background: 'rgba(8,8,8,0.9)', borderRadius: '4px', padding: '16px 18px', maxWidth: '560px', lineHeight: '1.65', border: '1px solid #252525', pointerEvents: 'auto' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '10px' }}>
            <div
              onClick={prevTooltip}
              style={{ cursor: 'pointer', color: '#888', fontSize: '28px', lineHeight: 1, padding: '2px 6px' }}
              title="Previous"
            >
              ‹
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '8px' }}>
                {[1, 2, 3].map(n => (
                  <span key={n} style={{ width: '5px', height: '5px', borderRadius: '50%', display: 'inline-block', background: n === tooltipIdx ? '#fff' : '#555' }} />
                ))}
              </div>
              <div style={{ color: '#fff', fontSize: '16px', letterSpacing: '0.04em' }}>
                {TOOLTIP_SECTIONS[tooltipIdx].title}
              </div>
            </div>
            <div
              onClick={nextTooltip}
              style={{ cursor: 'pointer', color: '#888', fontSize: '28px', lineHeight: 1, padding: '2px 6px' }}
              title="Next"
            >
              ›
            </div>
          </div>
          {TOOLTIP_SECTIONS[tooltipIdx].points.map((point, i) => (
            <div key={i} style={{ marginBottom: '6px' }}>
              {typeof point === 'string' ? (
                <span>— {point}</span>
              ) : (
                <>
                  <div>— {point.text}</div>
                  {point.sub.map((s, j) => (
                    <div key={j} style={{ paddingLeft: '14px', color: '#ccc' }}>— {s}</div>
                  ))}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
