import { useState, useCallback, useEffect, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Lock, Check, AlertCircle, ShieldBan, Eye, EyeOff, MessageCircle, Chrome, Github } from 'lucide-react';
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
/*  Ink splash decorations (CSS radial gradients at corners)          */
/* ------------------------------------------------------------------ */
function InkSplashes() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute -left-28 -top-28 h-72 w-72 opacity-[0.06]"
        style={{ background: 'radial-gradient(circle at 30% 30%, #1A1A1A 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-32 -right-32 h-96 w-96 opacity-[0.04]"
        style={{ background: 'radial-gradient(circle at 70% 70%, #1A1A1A 0%, transparent 70%)' }}
      />
      <div
        className="absolute -left-20 top-1/3 h-48 w-48 opacity-[0.03]"
        style={{ background: 'radial-gradient(circle at 50% 50%, #1A1A1A 0%, transparent 60%)' }}
      />
      <div
        className="absolute -right-16 top-2/3 h-40 w-40 opacity-[0.025]"
        style={{ background: 'radial-gradient(circle at 50% 50%, #1A1A1A 0%, transparent 60%)' }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animation variants                                                */
/* ------------------------------------------------------------------ */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1, y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 18, mass: 0.8 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.98 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring' as const, stiffness: 85, damping: 16, mass: 1 },
  },
};

/* ------------------------------------------------------------------ */
/*  Spinner                                                           */
/* ------------------------------------------------------------------ */
function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.15" />
      <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="30 50" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Underline-style input field                                       */
/* ------------------------------------------------------------------ */
interface InkInputProps {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'password';
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete?: string;
  inputMode?: 'email' | 'text';
  spellCheck?: boolean;
  autoFocus?: boolean;
  isPassword?: boolean;
}

function InkInput({ id, label, type = 'text', value, onChange, error, autoComplete, inputMode, spellCheck, autoFocus, isPassword }: InkInputProps) {
  const [focused, setFocused] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const hasValue = value.length > 0;
  const isFloating = focused || hasValue;
  const resolvedType = isPassword ? (showPw ? 'text' : 'password') : type;

  return (
    <div>
      <div className="relative">
        <label
          htmlFor={id}
          className={`block select-none transition-all duration-200 ${
            isFloating
              ? 'text-[12px] font-medium text-ink-gray'
              : 'text-[14px] text-ink-light'
          }`}
        >
          {label}
        </label>
        <div className="relative mt-1">
          <input
            id={id}
            type={resolvedType}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoComplete={autoComplete}
            inputMode={inputMode}
            spellCheck={spellCheck}
            autoFocus={autoFocus}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            className={`
              w-full border-b-2 bg-transparent pb-2 pt-1 text-[15px] text-ink-black outline-none
              transition-colors duration-200 placeholder:text-ink-light/40
              ${error ? 'border-cinnabar/60' : focused ? 'border-ink-black' : 'border-ink-white'}
            `}
            placeholder={isFloating ? '' : label}
          />
          {isPassword && hasValue && (
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-ink-light hover:text-ink-gray transition-colors"
              aria-label={showPw ? '隐藏密码' : '显示密码'}
              tabIndex={-1}
            >
              {showPw ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
            </button>
          )}
        </div>
      </div>
      {error && (
        <motion.p
          id={`${id}-error`}
          role="alert"
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-1.5 text-[12px] text-cinnabar"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom checkbox                                                   */
/* ------------------------------------------------------------------ */
function InkCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="group flex cursor-pointer items-center gap-2.5 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
        aria-label={label}
      />
      <span
        className={`flex h-4 w-4 items-center justify-center border-2 transition-all duration-200 ${
          checked
            ? 'border-ink-black bg-ink-black'
            : 'border-ink-light bg-transparent group-hover:border-ink-gray'
        }`}
        style={{ borderRadius: '2px' }}
      >
        {checked && <Check size={10} strokeWidth={3} stroke="white" />}
      </span>
      <span className="text-[13px] text-ink-gray transition-colors duration-200 group-hover:text-ink-black">
        {label}
      </span>
    </label>
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
        try { localStorage.setItem('aperture_session', JSON.stringify({ email: trimmedEmail, loggedIn: true, type: result.type || 'user' })) } catch {}
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
      <div className="relative min-h-screen overflow-hidden bg-paper-white">
        <InkSplashes />
        <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-12 sm:px-6">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex w-full max-w-[420px] flex-col items-center text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 14 }}
              className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-xs border border-cinnabar/30 bg-cinnabar/5">
              <ShieldBan size={40} className="text-cinnabar" />
            </motion.div>
            <h1 className="text-[28px] font-serif text-ink-black tracking-[4px]">{t('ip.banned_message', lang)}</h1>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-gray">{t('ip.banned_message', lang)}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-gray">{t('ip.contact_admin', lang)}</p>
            <div className="mt-8 border border-cinnabar/20 bg-cinnabar/5 px-6 py-3" style={{ borderRadius: '4px' }}>
              <p className="text-[11px] font-medium text-cinnabar">{t('ip.error_code', lang)}: IP_BANNED</p>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  /* ---------- render ---------- */
  return (
    <div className="relative min-h-screen overflow-hidden bg-paper-white">
      <InkSplashes />

      <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-12 sm:px-6">
        <motion.div
          className="w-full max-w-[420px]"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* ---- Brand ---- */}
          <motion.div variants={itemVariants} className="mb-10 text-center">
            <h1
              className="font-serif text-[38px] font-light text-ink-black select-none"
              style={{ letterSpacing: '8px' }}
            >
              墨语
            </h1>
            <p
              className="mt-3 text-[13px] text-ink-light select-none"
              style={{ letterSpacing: '4px' }}
            >
              以墨为语·以心对话
            </p>
          </motion.div>

          {/* ---- Card ---- */}
          <motion.div
            variants={cardVariants}
            className="bg-warm-white p-7 sm:p-8"
            style={{ borderRadius: '4px' }}
          >
            {/* Login error banner */}
            {loginError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 flex items-center gap-2 px-4 py-3 text-[13px] text-cinnabar"
                style={{ backgroundColor: 'rgba(184, 74, 62, 0.06)', borderRadius: '4px' }}
              >
                <AlertCircle size={15} strokeWidth={1.5} className="shrink-0" />
                {loginError}
              </motion.div>
            )}

            <form
              onSubmit={handleSubmit}
              noValidate
              aria-label="登录表单"
              className="space-y-6"
            >
              {/* ---- Email ---- */}
              <motion.div
                variants={itemVariants}
                key={`email-${shakeKey}`}
              >
                <InkInput
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
              >
                <InkInput
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
                className="flex items-center justify-between"
              >
                <InkCheckbox
                  checked={remember}
                  onChange={setRemember}
                  label={t('login.remember', lang)}
                />

                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="text-[13px] font-medium text-ink-gray transition-colors duration-200 hover:text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-black/20"
                  tabIndex={0}
                >
                  {t('login.forgot', lang)}
                </a>
              </motion.div>

              {/* ---- Submit button ---- */}
              <motion.div variants={itemVariants}>
                <button
                  type="submit"
                  disabled={loading}
                  className={`
                    relative flex h-12 w-full items-center justify-center text-[14px] font-medium
                    transition-all duration-[400ms] ease-out
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-black/30 focus-visible:ring-offset-2 focus-visible:ring-offset-warm-white
                    disabled:cursor-not-allowed
                    ${loading
                      ? 'opacity-80 bg-ink-dark'
                      : 'bg-ink-black hover:bg-ink-dark active:bg-ink-black'
                    }
                  `}
                  style={{ borderRadius: '4px', letterSpacing: '6px' }}
                  aria-label={loading ? '登录中...' : '登录'}
                >
                  {loading ? (
                    <span className="flex items-center gap-2.5">
                      <Spinner />
                      <span className="text-paper-white/90">{t('login.logging_in', lang)}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Lock size={15} strokeWidth={1.5} />
                      {t('login.submit', lang)}
                    </span>
                  )}
                </button>
              </motion.div>

              {/* ---- Footer link ---- */}
              <motion.p
                variants={itemVariants}
                className="pt-1 text-center text-[13px] text-ink-gray"
              >
                {t('login.no_account', lang)}{' '}
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); onRegister?.(); }}
                  className="font-medium text-ink-black transition-colors duration-200 hover:text-ink-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-black/20"
                  tabIndex={0}
                >
                  {t('login.register', lang)}
                </a>
              </motion.p>
            </form>
          </motion.div>

          {/* ---- Social login ---- */}
          <motion.div variants={itemVariants} className="mt-8">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-ink-white/80" />
              <span className="text-[11px] text-ink-light shrink-0" style={{ letterSpacing: '2px' }}>
                {lang === 'en' ? 'OR CONTINUE WITH' : '或使用社交账号登录'}
              </span>
              <div className="h-px flex-1 bg-ink-white/80" />
            </div>
            <div className="mt-5 flex items-center justify-center gap-8">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink-light transition-all duration-200 hover:text-ink-black hover:bg-ink-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-black/20"
                aria-label="微信登录"
                tabIndex={0}
              >
                <MessageCircle size={20} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink-light transition-all duration-200 hover:text-ink-black hover:bg-ink-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-black/20"
                aria-label="Google登录"
                tabIndex={0}
              >
                <Chrome size={20} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink-light transition-all duration-200 hover:text-ink-black hover:bg-ink-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-black/20"
                aria-label="GitHub登录"
                tabIndex={0}
              >
                <Github size={20} strokeWidth={1.5} />
              </button>
            </div>
          </motion.div>

          {/* ---- Footer credit ---- */}
          <motion.p
            variants={itemVariants}
            className="mt-6 text-center text-[11px] text-ink-light/60 select-none"
            style={{ letterSpacing: '3px' }}
          >
            &copy; {new Date().getFullYear()} Aperture
          </motion.p>
        </motion.div>
      </main>
    </div>
  );
}
