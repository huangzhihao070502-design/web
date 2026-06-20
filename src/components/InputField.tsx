import { useState, useCallback, type InputHTMLAttributes, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

interface InputFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  label: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'url';
  value: string;
  onChange: (val: string) => void;
  error?: string;
  icon?: ReactNode;
  isPassword?: boolean;
}

export default function InputField({
  label, type = 'text', value, onChange, error, icon, isPassword = false, className = '', id, ...inputProps
}: InputFieldProps) {
  const fieldId = id ?? `input-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const [focused, setFocused] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const hasValue = value.length > 0;
  const isFloating = focused || hasValue;

  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => setFocused(false), []);
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value), [onChange]);
  const togglePw = useCallback(() => setShowPw((s) => !s), []);

  const resolvedType = isPassword ? (showPw ? 'text' : 'password') : type;

  return (
    <div className="relative">
      <div className={`relative rounded-xl border transition-all duration-300 ${
        error ? 'border-cinnabar/50 bg-cinnabar/5' :
        focused ? 'border-copper/40 bg-warm-white' :
        'border-mist bg-warm-white hover:border-light-gray'
      }`}>
        <input id={fieldId} type={resolvedType} value={value} onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} aria-invalid={!!error} aria-describedby={error ? `${fieldId}-error` : undefined}
          className={`peer relative z-10 block w-full bg-transparent px-4 pb-2 pt-6 text-sm text-ink placeholder-transparent outline-none transition-colors ${error ? 'text-cinnabar' : ''} ${className}`} {...inputProps} />
        <label htmlFor={fieldId} className={`absolute left-4 z-0 pointer-events-none select-none transition-all duration-[280ms] ${
          isFloating ? 'top-2 text-[11px] font-medium' : 'top-1/2 -translate-y-1/2 text-sm'
        } ${error ? 'text-cinnabar' : focused ? 'text-copper' : 'text-soft-ink'}`}>{label}</label>
        {icon && <div className={`pointer-events-none absolute left-4 top-1/2 z-20 -translate-y-1/2 transition-all duration-[280ms] ${isFloating ? 'opacity-0 scale-75' : 'opacity-40'}`} aria-hidden="true">{icon}</div>}
        {isPassword && hasValue && (
          <button type="button" onClick={togglePw} className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-md p-1.5 text-soft-ink hover:text-ink transition-colors" aria-label={showPw ? '隐藏密码' : '显示密码'} tabIndex={-1}>
            {showPw ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
          </button>
        )}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} className="absolute right-3 top-1/2 z-20 -translate-y-1/2 text-cinnabar/60" aria-hidden="true">
              <AlertCircle size={18} strokeWidth={1.5} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait">
        {error && (
          <motion.p id={`${fieldId}-error`} role="alert" initial={{ opacity: 0, y: -6, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -6, height: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="mt-1.5 px-4 text-xs text-cinnabar">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
