import { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createTimeline } from 'animejs';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */
interface SplashScreenProps {
  onComplete: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [showSplash, setShowSplash] = useState(true);

  const splashRef    = useRef<HTMLDivElement>(null);
  const paperRef     = useRef<HTMLDivElement>(null);
  const inkDropRef   = useRef<HTMLDivElement>(null);
  const inkSpreadRef = useRef<HTMLDivElement>(null);
  const inkCenterRef = useRef<HTMLDivElement>(null);
  const logoRef      = useRef<HTMLDivElement>(null);
  const nameRef      = useRef<HTMLSpanElement>(null);
  const subRef       = useRef<HTMLSpanElement>(null);
  const completedRef = useRef(false);

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const $splash    = splashRef.current;
    const $paper     = paperRef.current;
    const $inkDrop   = inkDropRef.current;
    const $inkSpread = inkSpreadRef.current;
    const $inkCenter = inkCenterRef.current;
    const $logo      = logoRef.current;
    const $name      = nameRef.current;
    const $sub       = subRef.current;

    if (!$splash || !$paper || !$inkDrop || !$inkSpread || !$inkCenter || !$logo || !$name || !$sub) return;

    /* -------------------------------------------------------------- */
    /*  Anime.js timeline — phases 1-5 (entrance, 0-4200ms)          */
    /* -------------------------------------------------------------- */
    const tl = createTimeline({ autoplay: true });

    // Phase 1 (0-800ms): Paper background fades in + texture appears
    tl.add($paper, { opacity: [0, 1], duration: 800, easing: 'easeOutExpo' }, 0);

    // Phase 2 (800-1800ms): Ink drop falls from top center
    tl.add($inkDrop, {
      opacity: [0, 1],
      translateY: ['-40vh', '0'],
      scaleY: [1.6, 1],
      duration: 1000,
      easing: 'cubicBezier(0.25, 0.1, 0.25, 1.0)',
    }, 800);

    // Phase 3 (1800-2800ms): Ink hits and spreads radially
    // Center impact point appears quickly
    tl.add($inkCenter, {
      opacity: [0, 1],
      scale: [0, 1],
      duration: 200,
      easing: 'easeOutExpo',
    }, 1800);

    // Radial wash spreads for full 1000ms
    tl.add($inkSpread, {
      opacity: [0, 0.6],
      scale: [0.2, 2.2],
      duration: 1000,
      easing: 'easeOutQuart',
    }, 1800);

    // Phase 4 (2800-3600ms): Logo emerges — ink-wash circle with 墨 character
    tl.add($logo, {
      opacity: [0, 1],
      scale: [0.7, 1],
      duration: 800,
      easing: 'easeOutExpo',
    }, 2800);

    // Phase 5 (3600-4200ms): "InkOS" + subtitle fade in
    tl.add($name, {
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 600,
      easing: 'easeOutQuart',
    }, 3600);

    tl.add($sub, {
      opacity: [0, 1],
      translateY: [8, 0],
      duration: 600,
      easing: 'easeOutQuart',
    }, 3800);

    /* -------------------------------------------------------------- */
    /*  Phase 6 (4200-4500ms): Framer-motion exit fade                */
    /* -------------------------------------------------------------- */
    const exitTimer = setTimeout(() => {
      setShowSplash(false);
    }, 4200);

    /* ---- Cleanup ---- */
    return () => {
      clearTimeout(exitTimer);
      tl.seek(tl.totalTime);
    };
  }, [handleComplete]);

  return (
    <AnimatePresence onExitComplete={handleComplete}>
      {showSplash && (
        <motion.div
          ref={splashRef}
          className="fixed inset-0 flex items-center justify-center overflow-hidden"
          style={{
            background: '#F8F8F6',
            zIndex: 9999,
          }}
          exit={{
            opacity: 0,
            transition: { duration: 0.3, ease: 'easeOutQuad' },
          }}
        >
          {/* Paper texture overlay */}
          <div
            ref={paperRef}
            className="pointer-events-none absolute inset-0 opacity-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '400px 400px',
              zIndex: 1,
            }}
          />

          {/* Phase 2: Ink drop (teardrop shape falling from top) */}
          <div
            ref={inkDropRef}
            className="absolute pointer-events-none"
            style={{
              width: 8,
              height: 24,
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              background: '#1A1A1A',
              opacity: 0,
              zIndex: 2,
              willChange: 'transform, opacity',
              filter: 'blur(0.5px)',
            }}
          />

          {/* Phase 3: Ink center (point of impact) */}
          <div
            ref={inkCenterRef}
            className="absolute pointer-events-none"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#1A1A1A',
              opacity: 0,
              transform: 'scale(0)',
              zIndex: 3,
              willChange: 'transform, opacity',
            }}
          />

          {/* Phase 3: Radial ink spread (wash effect) */}
          <div
            ref={inkSpreadRef}
            className="absolute pointer-events-none"
            style={{
              width: 260,
              height: 260,
              borderRadius: '50%',
              background:
                'radial-gradient(circle at 50% 50%, rgba(26,26,26,0.35) 0%, rgba(26,26,26,0.12) 30%, rgba(26,26,26,0.04) 55%, transparent 70%)',
              opacity: 0,
              transform: 'scale(0.2)',
              zIndex: 2,
              willChange: 'transform, opacity',
              filter: 'blur(3px)',
            }}
          />

          {/* Phase 4: Logo — ink-wash circle with 墨 character */}
          <div
            ref={logoRef}
            className="absolute flex items-center justify-center pointer-events-none"
            style={{
              opacity: 0,
              transform: 'scale(0.7)',
              zIndex: 4,
              willChange: 'transform, opacity',
            }}
          >
            <svg viewBox="0 0 100 100" width="80" height="80" aria-hidden="true">
              {/* Outer ink-wash ring */}
              <circle cx="50" cy="50" r="46" fill="none" stroke="#1A1A1A" strokeWidth="0.8" opacity="0.3" />
              {/* Inner ink pool */}
              <circle cx="50" cy="50" r="30" fill="#1A1A1A" opacity="0.08" filter="url(#inkBlur)" />
              <defs>
                <filter id="inkBlur">
                  <feGaussianBlur stdDeviation="2.5" />
                </filter>
              </defs>
              {/* 墨 character — stylized minimal strokes */}
              <g fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
                {/* Top stroke */}
                <path d="M35,28 L65,28" />
                {/* Left vertical */}
                <path d="M42,28 L42,70" />
                {/* Bottom horizontal */}
                <path d="M35,70 L65,70" />
                {/* Right vertical */}
                <path d="M58,28 L58,55" />
                {/* Inner dot */}
                <circle cx="58" cy="62" r="2" fill="#1A1A1A" stroke="none" />
              </g>
            </svg>
          </div>

          {/* Phase 5: Brand text */}
          <div
            className="absolute flex flex-col items-center gap-1 pointer-events-none"
            style={{ top: 'calc(50% + 60px)', zIndex: 5 }}
          >
            <span
              ref={nameRef}
              style={{
                fontFamily: '"Noto Serif SC", "Source Han Serif SC", serif',
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: '0.16em',
                color: '#1A1A1A',
                opacity: 0,
                willChange: 'transform, opacity',
              }}
            >
              InkOS
            </span>
            <span
              ref={subRef}
              style={{
                fontFamily: '"Noto Serif SC", "Source Han Serif SC", serif',
                fontSize: 12,
                fontWeight: 300,
                letterSpacing: '0.12em',
                color: '#1A1A1A',
                opacity: 0,
                marginTop: 2,
                willChange: 'transform, opacity',
              }}
            >
              墨境系统
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
