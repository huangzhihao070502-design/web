import { type Variants } from 'framer-motion'

/* ─── Page Transition ─── */
export const pageEnter: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.25, ease: [0.22, 0.61, 0.36, 1] } },
}

/* ─── Fade In ─── */
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
}

/* ─── Stagger Children ─── */
export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 0.61, 0.36, 1] } },
}

/* ─── Scale In ─── */
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.22, 0.61, 0.36, 1] } },
}

/* ─── Slide Up ─── */
export const slideUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 0.61, 0.36, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
}

/* ─── Chat Message ─── */
export const messageEnter: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: [0.22, 0.61, 0.36, 1] } },
}
