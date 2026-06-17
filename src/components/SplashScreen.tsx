import { useEffect, useRef, useCallback } from 'react';
import { animate, createTimeline } from 'animejs';

/* ------------------------------------------------------------------ */
/*  Config                                                            */
/* ------------------------------------------------------------------ */
interface SplashConfig {
  particleCount: number;
  colors: {
    bg: string;
    brand: string;
    brandL: string;
    brandH: string;
    accent: string;
    text: string;
    muted: string;
  };
}

const DEFAULT_CONFIG: SplashConfig = {
  particleCount: 14,
  colors: {
    bg:      '#0B0B0C',
    brand:   '#2d2b55',
    brandL:  '#4a488a',
    brandH:  '#625f9a',
    accent:  '#C89F7E',
    text:    '#F4F4F4',
    muted:   '#9EA3AF',
  },
};

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */
interface SplashScreenProps {
  onComplete: () => void;
  config?: Partial<SplashConfig>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function SplashScreen({ onComplete, config: configOverrides }: SplashScreenProps) {
  const cfg = { ...DEFAULT_CONFIG, ...configOverrides, colors: { ...DEFAULT_CONFIG.colors, ...configOverrides?.colors } };

  const splashRef      = useRef<HTMLDivElement>(null);
  const ambientRef     = useRef<HTMLDivElement>(null);
  const coreRef        = useRef<HTMLDivElement>(null);
  const ring1Ref       = useRef<HTMLDivElement>(null);
  const ring2Ref       = useRef<HTMLDivElement>(null);
  const ring3Ref       = useRef<HTMLDivElement>(null);
  const logoRef        = useRef<HTMLDivElement>(null);
  const brandTextRef   = useRef<HTMLSpanElement>(null);
  const brandSubRef    = useRef<HTMLSpanElement>(null);
  const particlesRef   = useRef<HTMLDivElement>(null);
  const completedRef   = useRef(false);

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const $splash     = splashRef.current;
    const $ambient    = ambientRef.current;
    const $core       = coreRef.current;
    const $ring1      = ring1Ref.current;
    const $ring2      = ring2Ref.current;
    const $ring3      = ring3Ref.current;
    const $logo       = logoRef.current;
    const $brandText  = brandTextRef.current;
    const $brandSub   = brandSubRef.current;
    const $particles  = particlesRef.current;

    if (!$splash || !$ambient || !$core || !$ring1 || !$ring2 || !$ring3 || !$logo || !$brandText || !$brandSub || !$particles) return;

    /* ---- Generate particles ---- */
    const particleEls: HTMLDivElement[] = [];
    for (let i = 0; i < cfg.particleCount; i++) {
      const el = document.createElement('div');
      const size = Math.random() * 2.5 + 1;
      Object.assign(el.style, {
        width:        `${size}px`,
        height:       `${size}px`,
        borderRadius: '50%',
        background:   'rgba(255,255,255,0.25)',
        position:     'absolute',
        pointerEvents:'none',
        opacity:      '0',
        willChange:   'transform, opacity',
        backfaceVisibility: 'hidden',
      });
      const angle  = (i / cfg.particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const radius = 60 + Math.random() * 80;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      el.style.left = `${50 + Math.cos(angle) * (radius / vw * 100)}%`;
      el.style.top  = `${50 + Math.sin(angle) * (radius / vh * 100)}%`;
      $particles.appendChild(el);
      particleEls.push(el);
    }

    /* ---- Timeline ---- */
    const tl = createTimeline({ autoplay: true });

    // Phase 1 — Awakening (0–800ms)
    tl.add($ambient, { opacity: [0, 1], duration: 1200, easing: 'easeOutExpo' }, 0);
    tl.add($core,    { opacity: [0, 1], scale: [0, 1], duration: 800, easing: 'easeOutExpo' }, 200);

    // Phase 2 — Expansion (800–2000ms)
    tl.add($ring1, { opacity: [0, 0.12], scale: [0.6, 1], rotate: [0, 15], duration: 1200, easing: 'easeInOutSine' }, 800);
    tl.add($ring2, { opacity: [0, 0.08], scale: [0.7, 1], rotate: [0, -10], duration: 1400, easing: 'easeInOutSine' }, 1000);
    tl.add($ring3, { opacity: [0, 0.06], scale: [0.8, 1], rotate: [0, 8], duration: 1600, easing: 'easeInOutSine' }, 1200);

    // Slow continuous rotation
    const r1 = animate($ring1, { rotate: '+=360', duration: 30000, loop: true, easing: 'linear', autoplay: true });
    const r2 = animate($ring2, { rotate: '-=360', duration: 40000, loop: true, easing: 'linear', autoplay: true });
    const r3 = animate($ring3, { rotate: '+=360', duration: 50000, loop: true, easing: 'linear', autoplay: true });

    // Phase 3 — Logo Formation (2000–3500ms)
    tl.add($logo, { opacity: [0, 1], translateY: [20, 0], scale: [0.85, 1], rotate: [-3, 0], duration: 1200, easing: 'easeOutExpo' }, 2000);
    tl.add($brandText, { opacity: [0, 1], translateY: [8, 0], duration: 800, easing: 'easeOutQuart' }, 2600);
    tl.add($brandSub,  { opacity: [0, 1], translateY: [6, 0], duration: 800, easing: 'easeOutQuart' }, 2900);

    // Phase 4 — Stabilization (3500–5000ms)
    const breathe = animate($logo, { scale: [1, 1.02, 1], opacity: [1, 0.95, 1], duration: 3000, loop: true, easing: 'easeInOutSine', autoplay: true, delay: 3500 });

    particleEls.forEach((p, i) => {
      tl.add(p, { opacity: [0, 0.15 + Math.random() * 0.15], duration: 600, easing: 'easeOutQuart' }, 3200 + i * 60);
    });

    const drifts = particleEls.map((p) => {
      const dx = (Math.random() - 0.5) * 12;
      const dy = (Math.random() - 0.5) * 12;
      return animate(p, {
        translateX: [0, dx, 0],
        translateY: [0, dy, 0],
        duration: 4000 + Math.random() * 3000,
        loop: true,
        easing: 'easeInOutSine',
        autoplay: true,
        delay: 3500,
      });
    });

    // Phase 5 — Exit (5000–5800ms)
    tl.add($splash, { opacity: [1, 0], scale: [1, 1.03], duration: 800, easing: 'easeOutQuart' }, 5000);

    tl.then(() => {
      handleComplete();
    });

    /* ---- Cleanup ---- */
    return () => {
      r1.pause();
      r2.pause();
      r3.pause();
      breathe.pause();
      drifts.forEach(d => d.pause());
      particleEls.forEach(el => el.remove());
    };
  }, [cfg, handleComplete]);

  /* ---- Render ---- */
  return (
    <div
      ref={splashRef}
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: cfg.colors.bg,
        zIndex: 9999,
        willChange: 'opacity, transform',
        backfaceVisibility: 'hidden',
      }}
    >
      {/* Noise overlay */}
      <div
        className="pointer-events-none fixed"
        style={{
          inset: '-50%',
          width: '200%',
          height: '200%',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          opacity: 0.015,
          zIndex: 10,
          animation: 'noiseShift 10s steps(8) infinite',
        }}
      />

      {/* Ambient glow */}
      <div
        ref={ambientRef}
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(45,43,85,0.08) 0%, transparent 60%)',
          opacity: 0,
          zIndex: 1,
          willChange: 'opacity',
        }}
      />

      {/* Core light */}
      <div
        ref={coreRef}
        className="absolute"
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(200,159,126,0.4) 40%, transparent 70%)',
          boxShadow: '0 0 20px rgba(255,255,255,0.15), 0 0 60px rgba(200,159,126,0.08)',
          opacity: 0,
          transform: 'scale(0)',
          zIndex: 5,
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden',
        }}
      />

      {/* Orbital rings */}
      <div ref={ring1Ref} className="absolute rounded-full" style={{ width: 120, height: 120, border: '1px solid rgba(200,159,126,0.08)', opacity: 0, zIndex: 3, willChange: 'transform, opacity', backfaceVisibility: 'hidden' }} />
      <div ref={ring2Ref} className="absolute rounded-full" style={{ width: 200, height: 200, border: '1px solid rgba(45,43,85,0.1)',   opacity: 0, zIndex: 3, willChange: 'transform, opacity', backfaceVisibility: 'hidden' }} />
      <div ref={ring3Ref} className="absolute rounded-full" style={{ width: 300, height: 300, border: '1px solid rgba(158,163,175,0.06)', opacity: 0, zIndex: 3, willChange: 'transform, opacity', backfaceVisibility: 'hidden' }} />

      {/* Logo */}
      <div
        ref={logoRef}
        className="absolute flex flex-col items-center gap-4"
        style={{ opacity: 0, transform: 'translateY(20px) scale(0.85) rotate(-3deg)', zIndex: 6, willChange: 'transform, opacity', backfaceVisibility: 'hidden' }}
      >
        {/* Logo mark — layered planes (same as LoginPage) */}
        <div style={{ width: 56, height: 56 }}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: '100%', height: '100%' }}>
            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinejoin="round" opacity="0.6" />
            <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinejoin="round" opacity="0.8" />
          </svg>
        </div>
        <span
          ref={brandTextRef}
          style={{ fontSize: 18, fontWeight: 400, letterSpacing: '0.12em', color: cfg.colors.text, opacity: 0, textTransform: 'uppercase', willChange: 'opacity' }}
        >
          Aperture
        </span>
        <span
          ref={brandSubRef}
          style={{ fontSize: 11, fontWeight: 400, letterSpacing: '0.08em', color: cfg.colors.muted, opacity: 0, marginTop: -8, willChange: 'opacity' }}
        >
          Secure Messaging
        </span>
      </div>

      {/* Particles container */}
      <div ref={particlesRef} className="pointer-events-none absolute inset-0" style={{ zIndex: 4 }} />
    </div>
  );
}
