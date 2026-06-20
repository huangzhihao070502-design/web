'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import InkEngine, { type InkEffectName } from './ink/InkEngine';

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
  const [showText, setShowText] = useState(false);
  const [inkTrigger, setInkTrigger] = useState(false);
  const completedRef = useRef(false);
  const clickedRef = useRef(false);

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  /* -------------------------------------------------------------- */
  /*  Timeline: inkDrop -> text -> exit                              */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    // Start ink effect immediately
    setInkTrigger(true);

    // Show text after inkDrop settles (~2s)
    const textTimer = setTimeout(() => setShowText(true), 2000);

    // Exit splash after ~3.5s total
    const exitTimer = setTimeout(() => setShowSplash(false), 3500);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(exitTimer);
    };
  }, []);

  /* -------------------------------------------------------------- */
  /*  Skip — click anywhere to dismiss early                        */
  /* -------------------------------------------------------------- */
  const handleSkip = useCallback(() => {
    if (clickedRef.current || completedRef.current) return;
    clickedRef.current = true;
    setShowSplash(false);
  }, []);

  return (
    <AnimatePresence onExitComplete={handleComplete}>
      {showSplash && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center overflow-hidden"
          style={{
            background: '#FAF8F5',
            zIndex: 9999,
            cursor: 'pointer',
          }}
          exit={{
            opacity: 0,
            transition: { duration: 0.3, ease: 'easeOutQuad' },
          }}
          onClick={handleSkip}
        >
          {/* InkEngine canvas — full-screen inkDrop effect */}
          <InkEngine trigger={inkTrigger} effect="inkDrop" x={0.5} y={0.5} />

          {/* Brand text — appears after ink settles */}
          {showText && (
            <motion.div
              className="absolute flex flex-col items-center gap-3 pointer-events-none"
              style={{ zIndex: 50 }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOutQuart' }}
            >
              <span
                style={{
                  fontFamily: '"Noto Serif SC", "Source Han Serif SC", serif',
                  fontSize: 36,
                  fontWeight: 500,
                  letterSpacing: '0.16em',
                  color: '#1A1A1A',
                }}
              >
                墨语
              </span>
              <span
                style={{
                  fontFamily: '"Noto Serif SC", "Source Han Serif SC", serif',
                  fontSize: 14,
                  fontWeight: 300,
                  letterSpacing: '0.12em',
                  color: '#1A1A1A',
                }}
              >
                以墨为语·以心对话
              </span>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
