import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import CDViewer from './CDViewer';
import { makePerlin3D } from './textureUtils';
import { BACKGROUND_TEXTURES } from './backgroundTextures';

const TRACKS = [
  { label: 'TRACK 01', title: 'Inheritance', src: '/audio/track01.wav' },
  { label: 'TRACK 02', title: 'Track 02',    src: '/audio/track02.wav' },
  { label: 'TRACK 03', title: 'Track 03',    src: '/audio/track03.wav' },
];

// background shape variant per track — track 1 keeps the user-selected shape,
// tracks 2/3 swap to their own Op-Art variant (indices into SHAPE_VARIANTS in backgroundTextures.js)
const TRACK_SHAPE_OVERRIDE = { 1: 23, 2: 27 }; // Op-Art Spiral, Op-Art Wave Grid

// track 3 gets the orange/green palette instead of the globally-selected one (indices into TOPO_PALETTES)
const TRACK_PALETTE_OVERRIDE = { 2: 0 }; // Original

function fmt(s) {
  if (!isFinite(s) || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}


const TOOLTIP_SECTIONS = [
  null,
  {
    title: 'Sound 1 - Interlude',
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
  const [muted,     setMuted]     = useState(false);
  const [tooltipIdx, setTooltipIdx] = useState(0);
  const [scaleLayout, setScaleLayout] = useState({ scale: 1, height: 0 });
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [bgColor] = useState('#0d0d0d');

  useEffect(() => {
    document.documentElement.style.background = bgColor;
    document.body.style.background = bgColor;
    const root = document.getElementById('root');
    if (root) root.style.background = bgColor;
  }, [bgColor]);

  const [stereoColor, setStereoColor] = useState('#f2f0eb');

  const [noiseStrength] = useState(100); // locked
  const [noiseSize, setNoiseSize] = useState(0); // 0-100, manual zoom
  const [textureIdx] = useState(0); // only one texture now
  const [paletteIdx, setPaletteIdx] = useState(38); // Basalt
  const [shapeIdx, setShapeIdx] = useState(26); // Op-Art Zebra
  const [motionOn, setMotionOn] = useState(true);
  const [motionSpeed, setMotionSpeed] = useState(50); // 0-100, 50 = 1x real-time
  const noiseCanvasRef = useRef(null);
  const noiseParamsRef = useRef({ strength: 100, size: 0, textureIdx: 0, paletteIdx: 38, shapeIdx: 26, motionOn: true, motionSpeed: 50 });

  useEffect(() => {
    noiseParamsRef.current = { strength: noiseStrength, size: noiseSize, textureIdx, paletteIdx, shapeIdx, motionOn, motionSpeed };
  }, [noiseStrength, noiseSize, textureIdx, paletteIdx, shapeIdx, motionOn, motionSpeed]);

  useEffect(() => {
    const canvas = noiseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const noise3D = makePerlin3D(7);
    let raf, lastTime = 0, prevTime = 0, time = 0;
    const smoothedAudio = { bass: 0, mid: 0, treble: 0, beat: 0 };
    const SHAPE_TRANSITION_SEC = 2.2;
    let curShapeIdx = null, fromShapeIdx = null, shapeTransitionT = 0;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (now - lastTime < 45) return; // ~22fps — smooth enough for slow ambient motion
      const dt = prevTime ? (now - prevTime) / 1000 : 0.045;
      lastTime = now; prevTime = now;
      const { strength, size, textureIdx: idx, paletteIdx: pIdx, shapeIdx: sIdx, motionOn: on, motionSpeed: speed } = noiseParamsRef.current;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (strength <= 0) return;
      // speed 50 -> 1x real time; 0 -> frozen; 100 -> ~3x
      if (on) time += dt * (speed / 50);
      const texture = BACKGROUND_TEXTURES[idx] || BACKGROUND_TEXTURES[0];
      // sync the background's motion to the beat on whichever track is playing — eased toward
      // the raw analyser reading so the visual drifts fluidly instead of snapping frame to frame
      const target = playingRef.current ? audioReactiveRef.current : { bass: 0, mid: 0, treble: 0, beat: 0 };
      smoothedAudio.bass   += (target.bass   - smoothedAudio.bass)   * 0.14;
      smoothedAudio.mid    += (target.mid    - smoothedAudio.mid)    * 0.14;
      smoothedAudio.treble += (target.treble - smoothedAudio.treble) * 0.14;
      smoothedAudio.beat   += (target.beat   - smoothedAudio.beat)   * 0.2;
      const audio = smoothedAudio;
      // track 2 and 3 get their own shape variant; track 1 keeps whatever's selected
      const trackShapeIdx = TRACK_SHAPE_OVERRIDE[trackRef.current];
      const effectiveShapeIdx = trackShapeIdx !== undefined ? trackShapeIdx : sIdx;
      // track 3 gets its own palette; other tracks keep whatever's selected
      const trackPaletteIdx = TRACK_PALETTE_OVERRIDE[trackRef.current];
      const effectivePaletteIdx = trackPaletteIdx !== undefined ? trackPaletteIdx : pIdx;
      // crossfade into a newly-selected shape instead of snapping straight to it
      if (curShapeIdx === null) {
        curShapeIdx = effectiveShapeIdx;
      } else if (effectiveShapeIdx !== curShapeIdx) {
        fromShapeIdx = curShapeIdx;
        curShapeIdx = effectiveShapeIdx;
        shapeTransitionT = 0;
      }
      let shapeBlend = 1;
      if (fromShapeIdx !== null) {
        shapeTransitionT += dt;
        shapeBlend = Math.min(1, shapeTransitionT / SHAPE_TRANSITION_SEC);
        if (shapeBlend >= 1) fromShapeIdx = null;
      }
      ctx.save();
      ctx.globalAlpha = strength / 100;
      texture.draw(ctx, w, h, time, { strength: strength / 100, size: size / 100, paletteIdx: effectivePaletteIdx, shapeIdx: curShapeIdx, prevShapeIdx: fromShapeIdx, shapeBlend, audio }, noise3D);
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

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
  const volValueRef      = useRef(null);

  // Mutable state
  const insertedRef   = useRef(false);
  const playingRef    = useRef(false);
  const trackRef      = useRef(0);
  const volumeRef     = useRef(1.0);
  const mutedRef      = useRef(false);
  const audioRef      = useRef(null);
  const advancedRef      = useRef(false);
  const isSeekingRef     = useRef(false);
  const rafPlayRef    = useRef(null);
  const audioCtxRef   = useRef(null);
  const analyserRef   = useRef(null);
  const gainRef       = useRef(null);
  const freqDataRef   = useRef(null);
  const audioReactiveRef = useRef({ bass: 0, mid: 0, treble: 0, beat: 0 });
  const bassHistoryRef   = useRef([]);
  const beatEnvRef       = useRef(0);

  useEffect(() => {
    if (volKnobRef.current) volKnobRef.current.style.transform = `rotate(${(volumeRef.current * 270) - 135}deg)`;
  }, []);

  useLayoutEffect(() => {
    if (isMobile) return;
    function updateScale() {
      const container = scaleContainerRef.current, content = scaleContentRef.current;
      if (!container || !content) return;
      const containerWidth = container.offsetWidth;
      const naturalWidth = content.offsetWidth;
      const naturalHeight = content.offsetHeight;
      if (naturalWidth > 0 && naturalHeight > 0) {
        const MIN_SCALE = 0.6;
        const widthScale = containerWidth / naturalWidth;
        const heightScale = (window.innerHeight * 0.96) / naturalHeight;
        const scale = Math.max(Math.min(widthScale, heightScale), MIN_SCALE);
        const height = naturalHeight * scale;
        setScaleLayout(prev => (prev.scale === scale && prev.height === height) ? prev : { scale, height });
      }
    }
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (scaleContainerRef.current) ro.observe(scaleContainerRef.current);
    window.addEventListener('resize', updateScale);
    return () => { ro.disconnect(); window.removeEventListener('resize', updateScale); };
  }, [isMobile]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    function drawPlain(canvas, w, h) {
      if (!canvas) return;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = stereoColor;
      ctx.fillRect(0, 0, w, h);
    }
    drawPlain(woodLRef.current,    110, 360);
    drawPlain(woodRackRef.current, 812, 350);
    drawPlain(woodRRef.current,    110, 360);
  }, [isMobile, stereoColor]);

  useEffect(() => {
    const a = new Audio(TRACKS[0].src);
    a.volume = volumeRef.current;
    audioRef.current = a;
    function onEnded() {
      if (advancedRef.current) return;
      advancedRef.current = true;
      switchTrack((trackRef.current + 1) % TRACKS.length, true);
    }
    a.addEventListener('ended', onEnded);
    return () => a.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const EQ_BINS    = [1, 2, 4, 7, 11, 18, 28, 38, 52];
  const EQ_DEFAULT = [8, 17, 25, 20, 11, 22, 6, 13, 8];

  function startPlaybackLoop() {
    cancelAnimationFrame(rafPlayRef.current);
    function loop() {
      rafPlayRef.current = requestAnimationFrame(loop);
      const an = analyserRef.current, fd = freqDataRef.current, bars = barsRef.current?.children;
      if (an && fd) {
        an.getByteFrequencyData(fd);
        if (bars) Array.from(bars).forEach((b, i) => { b.style.height = `${6 + (fd[EQ_BINS[i]] / 255) * 28}px`; });

        // beat-frequency analysis feeding the animated background (see backgroundTextures.js)
        let bassSum = 0; for (let i = 1; i <= 4; i++) bassSum += fd[i];
        const bass = bassSum / 4 / 255;
        let midSum = 0; for (let i = 8; i <= 24; i++) midSum += fd[i];
        const mid = midSum / 17 / 255;
        let trebleSum = 0; for (let i = 30; i <= 55; i++) trebleSum += fd[i];
        const treble = trebleSum / 26 / 255;

        const hist = bassHistoryRef.current;
        hist.push(bass);
        if (hist.length > 30) hist.shift();
        const avg = hist.reduce((s, v) => s + v, 0) / hist.length;
        if (bass > avg * 1.35 && bass > 0.15) beatEnvRef.current = 1;
        else beatEnvRef.current = Math.max(0, beatEnvRef.current - 0.07);

        audioReactiveRef.current = { bass, mid, treble, beat: beatEnvRef.current };
      }
      const audio = audioRef.current;
      if (audio && !isSeekingRef.current) {
        const t = audio.currentTime || 0;
        const dur = isFinite(audio.duration) ? audio.duration : 0;
        if (progressInputRef.current) { progressInputRef.current.max = dur || 100; progressInputRef.current.value = t; }
        if (progressFillRef.current) progressFillRef.current.style.width = dur > 0 ? `${(t / dur) * 100}%` : '0%';
        if (progressTimeRef.current) progressTimeRef.current.textContent = `${fmt(t)} / ${fmt(dur)}`;
        // backstop for the 'ended' event, which some browsers fire late or not at all for wav files
        if (dur > 0) {
          if (t >= dur - 0.15 && !advancedRef.current) {
            advancedRef.current = true;
            switchTrack((trackRef.current + 1) % TRACKS.length, true);
          } else if (t < dur - 1) {
            advancedRef.current = false;
          }
        }
      }
    }
    loop();
  }

  function stopPlaybackLoop() {
    cancelAnimationFrame(rafPlayRef.current);
    const bars = barsRef.current?.children;
    if (bars) Array.from(bars).forEach((b, i) => { b.style.height = EQ_DEFAULT[i] + 'px'; });
    beatEnvRef.current = 0;
    bassHistoryRef.current = [];
    audioReactiveRef.current = { bass: 0, mid: 0, treble: 0, beat: 0 };
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

  function applyVolume() {
    const v = mutedRef.current ? 0 : volumeRef.current;
    if (gainRef.current) gainRef.current.gain.value = v; else if (audioRef.current) audioRef.current.volume = v;
  }

  function switchTrack(newIdx, autoAdvance = false) {
    const wasPlaying = playingRef.current || autoAdvance;
    const active = audioRef.current;

    active.pause();
    active.src = TRACKS[newIdx].src;
    applyVolume();
    if (wasPlaying) { active.play().catch(() => {}); if (!playingRef.current) { playingRef.current = true; setPlaying(true); } }

    trackRef.current = newIdx; setTrackIdx(newIdx); resetProgress();
    if (deckTextRef.current) deckTextRef.current.textContent = TRACKS[newIdx].label;
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
      const g = ctx.createGain(); g.gain.value = mutedRef.current ? 0 : volumeRef.current;
      gainRef.current = g;
      ctx.createMediaElementSource(audioRef.current).connect(g);
      g.connect(an); an.connect(ctx.destination);
      // once routed through createMediaElementSource, the element's own native volume still
      // gates output ahead of the gain node — keep it at unity so the gain node is in sole control
      audioRef.current.volume = 1;
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
    audioRef.current.play().catch(() => {});
    playingRef.current = true; setPlaying(true);
    if (spinCDRef.current) { spinCDRef.current.style.opacity = '1'; spinCDRef.current.style.animation = 'spin 1.8s linear infinite'; }
    if (deckTextRef.current) deckTextRef.current.textContent = TRACKS[trackRef.current].label;
    setLED('#00ff44', true);
    startPlaybackLoop();
  }

  function handlePause() {
    if (!insertedRef.current) return;
    audioRef.current.pause();
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
    audioRef.current.pause();
    playingRef.current = false; setPlaying(false);
    stopPlaybackLoop(); resetProgress();
    if (spinCDRef.current) { spinCDRef.current.style.opacity = '0'; spinCDRef.current.style.animation = 'none'; }
    if (trayRef.current) trayRef.current.style.transform = 'translateX(72px)';
    if (deckTextRef.current) deckTextRef.current.textContent = 'EJECT';
    setLED('#cc4400');
    setTimeout(() => {
      if (trayRef.current) trayRef.current.style.transform = 'translateX(0)';
      if (deckTextRef.current) deckTextRef.current.textContent = 'NO DISC';
      audioRef.current.src = TRACKS[0].src;
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
      if (mutedRef.current) { mutedRef.current = false; setMuted(false); }
      if (volKnobRef.current)  volKnobRef.current.style.transform  = `rotate(${(v * 270) - 135}deg)`;
      if (volValueRef.current) volValueRef.current.textContent = String(Math.round(v * 100));
      applyVolume();
    }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleVolume(e) {
    const v = parseFloat(e.target.value);
    setVolume(v); volumeRef.current = v;
    if (mutedRef.current) { mutedRef.current = false; setMuted(false); }
    if (volKnobRef.current) volKnobRef.current.style.transform = `rotate(${(v * 270) - 135}deg)`;
    applyVolume();
  }

  function handleMuteToggle() {
    const next = !mutedRef.current;
    mutedRef.current = next; setMuted(next);
    applyVolume();
  }

  function handleProgressMouseDown() { isSeekingRef.current = true; }
  function handleProgressChange(e) {
    const t = parseFloat(e.target.value), audio = audioRef.current;
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

  return (
    <>
    <canvas ref={noiseCanvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
    {!isMobile && (
    <div ref={scaleContainerRef} style={{ width: '80%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', height: scaleLayout.height || undefined }}>
    <div ref={scaleContentRef} style={{ fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '48px', padding: '0px 0 40px', minHeight: '600px', flexShrink: 0, transform: `scale(${scaleLayout.scale})`, transformOrigin: 'top center' }}>

      {/* CD — 3D model, click to insert */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <div style={{ fontFamily: 'cursive', fontSize: '30px', color: '#ffffff', width: '100%', textAlign: 'center', opacity: inserted ? 0 : 1, transition: 'opacity 0.3s', marginTop: '40px' }}>three sounds</div>
        <div style={{ marginTop: '-40px' }}>
          <CDViewer
            phase={cdPhase}
            onClick={triggerInsert}
            onInsertDone={() => { setCdPhase('inserted'); handlePlay(); }}
          />
        </div>
        <div style={{ fontFamily: 'cursive', fontSize: '19px', color: '#ffffff', width: '100%', textAlign: 'center', opacity: inserted ? 0 : 1, transition: 'opacity 0.3s', marginTop: '-30px' }}>click cd to insert</div>
      </div>

      {/* Speakers + Rack */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

        {/* Left speaker */}
        <div style={{ width: '110px', height: '360px', borderRadius: '6px', border: '2px solid rgba(255,255,255,0.8)', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
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
        <div style={{ width: '780px', borderRadius: '6px', border: '2px solid rgba(255,255,255,0.8)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.7)' }}>
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
                <div style={{ position: 'absolute', right: '4px', top: '2px', width: '22px', height: '22px', boxSizing: 'border-box', borderRadius: '50%', background: '#0a0a0a', border: '1px solid #333', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                <button onClick={handleMuteToggle} className="transport-btn"
                  style={{ marginLeft: '10px', padding: '5px 9px', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', borderRadius: '3px', border: `1px solid ${muted ? '#cc4400' : '#444'}`, background: muted ? '#220000' : '#2a2a2a', color: muted ? '#cc4400' : '#aaa', cursor: 'pointer', lineHeight: 1 }}>
                  MUTE
                </button>
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
        <div style={{ width: '110px', height: '360px', borderRadius: '6px', border: '2px solid rgba(255,255,255,0.8)', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
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
    )}

    {isMobile && (
      <div style={{ position: 'relative', zIndex: 1, fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', padding: '0px 16px 40px', width: '100%', boxSizing: 'border-box' }}>

        {/* CD — 3D model, click to insert */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontFamily: 'cursive', fontSize: '26px', color: '#ffffff', width: '100%', textAlign: 'center', opacity: inserted ? 0 : 1, transition: 'opacity 0.3s', marginTop: '24px' }}>three sounds</div>
          <div style={{ marginTop: '-21px' }}>
            <CDViewer
              phase={cdPhase}
              onClick={triggerInsert}
              onInsertDone={() => { setCdPhase('inserted'); handlePlay(); }}
            />
          </div>
          <div style={{ fontFamily: 'cursive', fontSize: '17px', color: '#ffffff', width: '100%', textAlign: 'center', opacity: inserted ? 0 : 1, transition: 'opacity 0.3s', marginTop: '-24px' }}>click cd to insert</div>
        </div>

        {/* Simplified deck panel */}
        <div style={{ width: '100%', maxWidth: '380px', marginTop: '40px', background: stereoColor, borderRadius: '6px', border: '2px solid #333', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box' }}>

          {/* Deck text + LED + eject */}
          <div style={{ background: '#1e1e1e', borderRadius: '3px', border: '1px solid #333', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div ref={ampLedRef} style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#cc4400', border: '1px solid #aa3300', flexShrink: 0 }} />
            <div style={{ flex: 1, height: '28px', background: '#001800', border: '1px solid #003300', borderRadius: '2px', display: 'flex', alignItems: 'center', padding: '0 10px' }}>
              <span ref={deckTextRef} style={{ fontSize: '12px', color: '#00cc44', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>NO DISC</span>
            </div>
            <button onClick={handleEject} disabled={!inserted} className="transport-btn"
              style={{ padding: '5px 10px', fontSize: '14px', borderRadius: '3px', border: '1px solid #444', background: '#2a2a2a', color: inserted ? '#aaa' : '#444', cursor: inserted ? 'pointer' : 'default', lineHeight: 1 }}>⏏</button>
          </div>

          {/* Progress */}
          <div style={{ background: '#1e1e1e', borderRadius: '3px', border: '1px solid #333', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ position: 'relative', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div ref={barsRef} style={{ position: 'absolute', left: 0, top: 0, height: '18px', overflow: 'hidden', display: 'flex', gap: '2px', alignItems: 'flex-end', flexShrink: 0 }}>
                {EQ_DEFAULT.map((h, i) => (
                  <div key={i} style={{ width: '4px', height: `${h * 0.55}px`, background: '#00cc44', borderRadius: '1px' }} />
                ))}
              </div>
              <span ref={progressTimeRef} style={{ fontSize: '12px', color: '#00cc44', fontFamily: 'monospace', textAlign: 'center' }}>0:00 / 0:00</span>
            </div>
            <div style={{ position: 'relative', height: '24px', display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, height: '5px', background: '#2a2a2a', borderRadius: '3px', border: '1px solid #333' }}>
                <div ref={progressFillRef} style={{ height: '100%', width: '0%', background: 'linear-gradient(90deg,#003300,#00cc44)', borderRadius: '3px' }} />
              </div>
              <input ref={progressInputRef} type="range" min="0" max="100" step="0.1" defaultValue="0"
                onMouseDown={handleProgressMouseDown} onChange={handleProgressChange} onMouseUp={handleProgressMouseUp} onTouchEnd={handleProgressMouseUp}
                disabled={!inserted}
                style={{ position: 'absolute', left: 0, right: 0, width: '100%', opacity: 0, cursor: inserted ? 'pointer' : 'default', margin: 0, height: '24px' }} />
            </div>
          </div>

          {/* Transport */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleLast} disabled={!inserted} className="transport-btn"
              style={{ flex: 1, padding: '14px 0', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', borderRadius: '4px', border: '1px solid #444', background: '#2a2a2a', color: inserted ? '#ccc' : '#444', cursor: inserted ? 'pointer' : 'default' }}>◀◀</button>
            <button onClick={handlePlay} disabled={!inserted || playing} className="transport-btn"
              style={{ flex: 1, padding: '14px 0', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', borderRadius: '4px', border: `1px solid ${playing ? '#00cc44' : '#444'}`, background: playing ? '#002200' : '#2a2a2a', color: playing ? '#00cc44' : (inserted ? '#ccc' : '#444'), cursor: (inserted && !playing) ? 'pointer' : 'default' }}>▶</button>
            <button onClick={handlePause} disabled={!inserted || !playing} className="transport-btn"
              style={{ flex: 1, padding: '14px 0', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', borderRadius: '4px', border: `1px solid ${(inserted && !playing) ? '#cc4400' : '#444'}`, background: (inserted && !playing) ? '#220000' : '#2a2a2a', color: (inserted && !playing) ? '#cc4400' : ((inserted && playing) ? '#ccc' : '#444'), cursor: (inserted && playing) ? 'pointer' : 'default' }}>⏸</button>
            <button onClick={handleNext} disabled={!inserted} className="transport-btn"
              style={{ flex: 1, padding: '14px 0', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', borderRadius: '4px', border: '1px solid #444', background: '#2a2a2a', color: inserted ? '#ccc' : '#444', cursor: inserted ? 'pointer' : 'default' }}>▶▶</button>
          </div>

          {/* Volume */}
          <div style={{ background: '#1e1e1e', borderRadius: '3px', border: '1px solid #333', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: '#999', fontFamily: 'monospace', width: '30px', flexShrink: 0 }}>VOL</span>
            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolume} style={{ flex: 1 }} />
            <span style={{ fontSize: '11px', color: '#00cc44', fontFamily: 'monospace', width: '28px', textAlign: 'right', flexShrink: 0 }}>{Math.round(volume * 100)}</span>
            <button onClick={handleMuteToggle} className="transport-btn"
              style={{ marginLeft: '10px', padding: '5px 9px', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', borderRadius: '3px', border: `1px solid ${muted ? '#cc4400' : '#444'}`, background: muted ? '#220000' : '#2a2a2a', color: muted ? '#cc4400' : '#aaa', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>
              MUTE
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Info dot — fixed to viewport, outside transformed ancestor */}
    <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 200, pointerEvents: 'none' }}>
      <div
        ref={tooltipDotRef}
        className="info-dot"
        onClick={() => setTooltipIdx(prev => prev === 0 ? 1 : 0)}
        style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#111', border: '1.5px solid #f2f0eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#f2f0eb', fontSize: tooltipIdx > 0 ? '16px' : '17px', fontStyle: tooltipIdx > 0 ? 'normal' : 'italic', fontWeight: 700, fontFamily: tooltipIdx > 0 ? 'monospace' : 'serif', userSelect: 'none', pointerEvents: 'auto' }}
      >
        {tooltipIdx > 0 ? '×' : 'i'}
      </div>
    </div>

    {/* Tooltip dialog — centered on screen on mobile, anchored below the info dot on desktop */}
    {tooltipIdx > 0 && (
      <div style={isMobile
        ? { position: 'fixed', top: '58px', left: 0, right: 0, zIndex: 199, display: 'flex', justifyContent: 'center', padding: '0 20px', boxSizing: 'border-box', pointerEvents: 'none' }
        : { position: 'fixed', top: '58px', right: '20px', zIndex: 199, pointerEvents: 'none' }
      }>
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
      </div>
    )}
    </>
  );
}
