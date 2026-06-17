import { useState, useCallback, useEffect, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Lock, Check, AlertCircle, ShieldBan } from 'lucide-react';
import MeshBackground from './MeshBackground';
import InputField from './InputField';
import { login } from '../lib/auth';
import { t, Lang } from '../lib/i18n';

function useLocalLang(): Lang {
  try { const s = JSON.parse(localStorage.getItem('webchat_settings') || '{}'); return s.general_language === 'en' ? 'en' : 'zh-CN'; } catch { return 'zh-CN'; }
}

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface FormErrors {
  email?: string;
  password?: string;
}

/* ------------------------------------------------------------------ */
/*  Animation variants (spring-driven staggered entrance)             */
/* ------------------------------------------------------------------ */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 90,
      damping: 16,
      mass: 0.8,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 36, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 80,
      damping: 15,
      mass: 1,
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Logo icon (inline SVG for zero dependencies)                      */
/* ------------------------------------------------------------------ */
function LogoIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2L2 7l10 5 10-5-10-5z"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M2 17l10 5 10-5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.6"
      />
      <path
        d="M2 12l10 5 10-5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Spinner                                                           */
/* ------------------------------------------------------------------ */
function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin-slow"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.15"
      />
      <path
        d="M12 2a10 10 0 019.95 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="30 50"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */
interface Props {
  onRegister?: () => void;
  onLoginSuccess?: () => void;
}

export default function LoginPage({ onRegister, onLoginSuccess }: Props) {
  const lang = useLocalLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [loginError, setLoginError] = useState('');
  const [ipBanned, setIpBanned] = useState(false);

  /* ---------- IP ban check on mount ---------- */
  useEffect(() => {
    fetch('/api/status').then(r => {
      if (r.status === 403) return r.json().then(d => { if (d.error === 'IP_BANNED') setIpBanned(true); });
    }).catch(() => {});
  }, []);

  /* ---------- validation ---------- */
  const validate = useCallback((): boolean => {
    const next: FormErrors = {};

    if (!email.trim()) {
      next.email = t('login.email_required', lang);
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = t('login.email_invalid', lang);
    }

    if (!password) {
      next.password = t('login.password_required', lang);
    } else if (password.length < 6) {
      next.password = t('login.password_short', lang);
    }

    setErrors(next);
    if (Object.keys(next).length > 0) {
      setShakeKey((k) => k + 1);
    }
    return Object.keys(next).length === 0;
  }, [email, password]);

  /* ---------- submit ---------- */
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setLoginError('');
      if (!validate()) return;

      setLoading(true);
      await new Promise((r) => setTimeout(r, 1000));
      const trimmedEmail = email.trim();
      const result = login(trimmedEmail, password);
      setLoading(false);

      if (result.success) {
        if (remember) {
          try { localStorage.setItem('aperture_session', JSON.stringify({ email: trimmedEmail, loggedIn: true })) } catch {}
        }
        onLoginSuccess?.();
      } else {
        setLoginError(result.message);
        setShakeKey((k) => k + 1);
      }
    },
    [validate, email, password, remember, onLoginSuccess],
  );

  /* ---------- clear error on input ---------- */
  const handleEmailChange = useCallback((v: string) => {
    setEmail(v);
    setErrors((prev) => (prev.email ? { ...prev, email: undefined } : prev));
  }, []);
  const handlePasswordChange = useCallback((v: string) => {
    setPassword(v);
    setErrors((prev) =>
      prev.password ? { ...prev, password: undefined } : prev,
    );
  }, []);

  /* ---------- IP banned screen ---------- */
  if (ipBanned) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#f5f0eb] font-sans">
        <MeshBackground />
        <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-12 sm:px-6">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex w-full max-w-[410px] flex-col items-center text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 14 }}
              className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl border border-red-200/50 bg-red-50/60 shadow-sm">
              <ShieldBan size={40} className="text-red-400" />
            </motion.div>
            <h1 className="text-[28px] font-light tracking-[-0.02em] text-[#1a1a2e]">{t('ip.banned_message', lang)}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#8a8a9a]">{t('ip.banned_message', lang)}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-[#8a8a9a]">{t('ip.contact_admin', lang)}</p>
            <div className="mt-8 rounded-2xl border border-red-200/30 bg-red-50/40 px-6 py-4">
              <p className="text-[12px] font-medium text-red-400">{t('ip.error_code', lang)}: IP_BANNED</p>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  /* ---------- render ---------- */
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f0eb] font-sans">
      <MeshBackground />

      {/* Main content */}
      <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-12 sm:px-6">
        <motion.div
          className="w-full max-w-[410px]"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* ---- Brand / Header ---- */}
          <motion.div variants={itemVariants} className="mb-10 text-center">
            <motion.div
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                background:
                  'linear-gradient(135deg, #2d2b55 0%, #4a488a 50%, #625f9a 100%)',
                boxShadow:
                  '0 4px 16px rgba(45,43,85,0.25), 0 1px 4px rgba(45,43,85,0.15)',
              }}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <LogoIcon />
            </motion.div>
            <h1 className="text-[26px] font-light tracking-[-0.02em] text-[#1a1a2e]">
              {t('login.welcome', lang)}
            </h1>
            <p className="mt-2 text-[15px] font-normal leading-relaxed text-[#8a8a9a]">
              {t('login.subtitle', lang)}
            </p>
          </motion.div>

          {/* ---- Card ---- */}
          <motion.div
            variants={cardVariants}
            className="rounded-2xl border border-white/70 bg-white/75 p-7 backdrop-blur-2xl sm:p-8"
            style={{
              boxShadow:
                '0 2px 4px rgba(0,0,0,0.02), 0 8px 24px rgba(0,0,0,0.04), 0 32px 64px rgba(0,0,0,0.06), inset 0 1px 1px rgba(255,255,255,0.6)',
            }}
          >
            {/* Login error banner */}
            {loginError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 flex items-center gap-2 rounded-xl bg-red-50/80 px-4 py-3 text-[14px] text-red-600"
              >
                <AlertCircle size={16} strokeWidth={1.5} className="shrink-0" />
                {loginError}
              </motion.div>
            )}

            <form
              onSubmit={handleSubmit}
              noValidate
              aria-label="登录表单"
              className="space-y-5"
            >
              {/* ---- Email ---- */}
              <motion.div
                variants={itemVariants}
                key={`email-${shakeKey}`}
                className={errors.email ? 'shake' : ''}
              >
                <InputField
                  id="login-email"
                  label={t('login.email', lang)}
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  error={errors.email}
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  autoFocus
                />
              </motion.div>

              {/* ---- Password ---- */}
              <motion.div
                variants={itemVariants}
                key={`password-${shakeKey}`}
                className={errors.password ? 'shake' : ''}
              >
                <InputField
                  id="login-password"
                  label={t('login.password', lang)}
                  value={password}
                  onChange={handlePasswordChange}
                  error={errors.password}
                  isPassword
                  autoComplete="current-password"
                />
              </motion.div>

              {/* ---- Options row ---- */}
              <motion.div
                variants={itemVariants}
                className="flex items-center justify-between pt-1"
              >
                {/* Remember me */}
                <label className="group flex cursor-pointer items-center gap-2.5 select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="sr-only"
                    aria-label="记住我"
                  />
                  <span className="checkbox-custom">
                    <Check size={12} strokeWidth={2.5} stroke="white" />
                  </span>
                  <span className="text-[14px] text-[#6b6b80] transition-colors duration-200 group-hover:text-[#4a4a5e]">
                    {t('login.remember', lang)}
                  </span>
                </label>

                {/* Forgot password */}
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="
                    text-[14px] font-medium text-[#2d2b55]
                    transition-all duration-200
                    hover:text-[#4a488a]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d2b55]/30 focus-visible:rounded
                  "
                  tabIndex={0}
                >
                  {t('login.forgot', lang)}
                </a>
              </motion.div>

              {/* ---- Submit button ---- */}
              <motion.div variants={itemVariants} className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className={`
                    btn-shine relative flex h-12 w-full items-center justify-center
                    rounded-xl text-[15px] font-medium text-white
                    transition-all duration-[400ms] cubic-bezier(0.22,1,0.36,1)
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d2b55]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white
                    disabled:cursor-not-allowed
                    ${loading
                      ? 'opacity-85'
                      : 'hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(45,43,85,0.3)] active:translate-y-0 active:shadow-[0_2px_8px_rgba(45,43,85,0.2)]'
                    }
                  `}
                  style={{
                    background: loading
                      ? 'linear-gradient(135deg, #2d2b55 0%, #4a488a 100%)'
                      : 'linear-gradient(135deg, #2d2b55 0%, #4a488a 60%, #625f9a 100%)',
                    boxShadow: loading
                      ? '0 2px 8px rgba(45,43,85,0.2)'
                      : '0 4px 16px rgba(45,43,85,0.25), 0 1px 4px rgba(45,43,85,0.15)',
                  }}
                  aria-label={loading ? '登录中...' : '登录'}
                >
                  {loading ? (
                    <span className="flex items-center gap-2.5">
                      <Spinner />
                      <span className="text-white/90">{t('login.logging_in', lang)}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Lock size={16} strokeWidth={1.5} />
                      {t('login.submit', lang)}
                    </span>
                  )}
                </button>
              </motion.div>

              {/* ---- Footer link ---- */}
              <motion.p
                variants={itemVariants}
                className="pt-2 text-center text-[14px] text-[#8a8a9a]"
              >
                {t('login.no_account', lang)}{' '}
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); onRegister?.(); }}
                  className="
                    font-medium text-[#2d2b55]
                    transition-colors duration-200
                    hover:text-[#4a488a]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d2b55]/30 focus-visible:rounded
                  "
                  tabIndex={0}
                >
                  {t('login.register', lang)}
                </a>
              </motion.p>
            </form>
          </motion.div>

          {/* ---- Footer credit ---- */}
          <motion.p
            variants={itemVariants}
            className="mt-6 text-center text-[12px] tracking-wide text-[#b0b0ba] uppercase"
          >
            &copy; {new Date().getFullYear()} Aperture
          </motion.p>
        </motion.div>
      </main>
    </div>
  );
}
