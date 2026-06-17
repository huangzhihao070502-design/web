import { useState, useCallback, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Check } from 'lucide-react';
import MeshBackground from './MeshBackground';
import InputField from './InputField';
import { register, isRegistered } from '../lib/auth';
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
  confirm?: string;
}

/* ------------------------------------------------------------------ */
/*  Animation variants                                                */
/* ------------------------------------------------------------------ */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { transition: { type: 'spring' as const, stiffness: 90, damping: 16, mass: 0.8 }, opacity: 1, y: 0 },
};
const cardVariants = {
  hidden: { opacity: 0, y: 36, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 80, damping: 15, mass: 1 } },
};

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin-slow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.15" />
      <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="30 50" />
    </svg>
  );
}

interface Props { onLogin: () => void; }

export default function RegisterPage({ onLogin }: Props) {
  const lang = useLocalLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [successMsg, setSuccessMsg] = useState('');

  const validate = useCallback((): boolean => {
    const next: FormErrors = {};
    if (!email.trim()) next.email = t('login.email_required', lang);
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('login.email_invalid', lang);
    if (!password) next.password = t('login.password_required', lang);
    else if (password.length < 6) next.password = t('login.password_short', lang);
    if (!confirm) next.confirm = t('register.confirm_required', lang);
    else if (password !== confirm) next.confirm = t('register.password_mismatch', lang);
    setErrors(next);
    if (Object.keys(next).length > 0) setShakeKey((k) => k + 1);
    return Object.keys(next).length === 0;
  }, [email, password, confirm]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (isRegistered(email.trim())) {
      if (!window.confirm('该邮箱已注册，将更新密码。确定继续？')) return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    const result = register(email.trim(), password);
    setLoading(false);
    if (result.success) { setSuccessMsg(result.message); setTimeout(() => onLogin(), 1800); }
  }, [validate, email, password, onLogin]);

  const handleEmailChange = useCallback((v: string) => { setEmail(v); setErrors((p) => (p.email ? { ...p, email: undefined } : p)); }, []);
  const handlePasswordChange = useCallback((v: string) => { setPassword(v); setErrors((p) => (p.password ? { ...p, password: undefined } : p)); }, []);
  const handleConfirmChange = useCallback((v: string) => { setConfirm(v); setErrors((p) => (p.confirm ? { ...p, confirm: undefined } : p)); }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f0eb] font-sans">
      <MeshBackground />
      <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-12 sm:px-6">
        <motion.div className="w-full max-w-[410px]" variants={containerVariants} initial="hidden" animate="visible">
          <motion.div variants={itemVariants} className="mb-10 text-center">
            <motion.div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #2d2b55 0%, #4a488a 50%, #625f9a 100%)', boxShadow: '0 4px 16px rgba(45,43,85,0.25), 0 1px 4px rgba(45,43,85,0.15)' }}
              whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
              <UserPlus size={22} strokeWidth={1.5} className="text-white" />
            </motion.div>
            <h1 className="text-[26px] font-light tracking-[-0.02em] text-[#1a1a2e]">{t('register.title', lang)}</h1>
            <p className="mt-2 text-[15px] font-normal leading-relaxed text-[#8a8a9a]">{t('register.subtitle', lang)}</p>
          </motion.div>

          <motion.div variants={cardVariants} className="rounded-2xl border border-white/70 bg-white/75 p-7 backdrop-blur-2xl sm:p-8"
            style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.02), 0 8px 24px rgba(0,0,0,0.04), 0 32px 64px rgba(0,0,0,0.06), inset 0 1px 1px rgba(255,255,255,0.6)' }}>
            {successMsg && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="mb-5 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-[14px] text-green-700">
                <Check size={16} strokeWidth={2} />{successMsg}<span className="ml-1 opacity-60">（即将跳转登录）</span>
              </motion.div>
            )}
            <form onSubmit={handleSubmit} noValidate aria-label="注册表单" className="space-y-5">
              <motion.div variants={itemVariants} key={`email-${shakeKey}`} className={errors.email ? 'shake' : ''}>
                <InputField id="reg-email" label={t('login.email', lang)} type="email" value={email} onChange={handleEmailChange}
                  error={errors.email} autoComplete="email" inputMode="email" spellCheck={false} autoFocus />
              </motion.div>
              <motion.div variants={itemVariants} key={`pw-${shakeKey}`} className={errors.password ? 'shake' : ''}>
                <InputField id="reg-password" label={t('login.password', lang)} value={password} onChange={handlePasswordChange}
                  error={errors.password} isPassword autoComplete="new-password" />
              </motion.div>
              <motion.div variants={itemVariants} key={`confirm-${shakeKey}`} className={errors.confirm ? 'shake' : ''}>
                <InputField id="reg-confirm" label={t('register.confirm_password', lang)} value={confirm} onChange={handleConfirmChange}
                  error={errors.confirm} isPassword autoComplete="new-password" />
              </motion.div>
              <motion.div variants={itemVariants} className="pt-1">
                <button type="submit" disabled={loading}
                  className={`btn-shine relative flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-medium text-white transition-all duration-[400ms] cubic-bezier(0.22,1,0.36,1) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d2b55]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed ${loading ? 'opacity-85' : 'hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(45,43,85,0.3)] active:translate-y-0 active:shadow-[0_2px_8px_rgba(45,43,85,0.2)]'}`}
                  style={{ background: loading ? 'linear-gradient(135deg, #2d2b55 0%, #4a488a 100%)' : 'linear-gradient(135deg, #2d2b55 0%, #4a488a 60%, #625f9a 100%)', boxShadow: loading ? '0 2px 8px rgba(45,43,85,0.2)' : '0 4px 16px rgba(45,43,85,0.25), 0 1px 4px rgba(45,43,85,0.15)' }}
                  aria-label={loading ? '注册中...' : '注册'}>
                  {loading ? (
                    <span className="flex items-center gap-2.5"><Spinner /><span className="text-white/90">{t('register.registering', lang)}</span></span>
                  ) : (
                    <span className="flex items-center gap-2"><UserPlus size={16} strokeWidth={1.5} />{t('register.submit', lang)}</span>
                  )}
                </button>
              </motion.div>
              <motion.p variants={itemVariants} className="pt-2 text-center text-[14px] text-[#8a8a9a]">
                {t('register.has_account', lang)}{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); onLogin(); }}
                  className="font-medium text-[#2d2b55] transition-colors duration-200 hover:text-[#4a488a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d2b55]/30 focus-visible:rounded" tabIndex={0}>
                  {t('register.go_login', lang)}
                </a>
              </motion.p>
            </form>
          </motion.div>
          <motion.p variants={itemVariants} className="mt-10 text-center text-[12px] tracking-wide text-[#b0b0ba] uppercase">&copy; {new Date().getFullYear()} Aperture</motion.p>
        </motion.div>
      </main>
    </div>
  );
}
