import {
  useState,
  useCallback,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface InputFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  label: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'url';
  value: string;
  onChange: (val: string) => void;
  error?: string;
  icon?: ReactNode;
  isPassword?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function InputField({
  label,
  type = 'text',
  value,
  onChange,
  error,
  icon,
  isPassword = false,
  className = '',
  id,
  ...inputProps
}: InputFieldProps) {
  const fieldId = id ?? `input-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const [focused, setFocused] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const hasValue = value.length > 0;
  const isFloating = focused || hasValue;

  /* ---------- handlers ---------- */
  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => setFocused(false), []);
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    [onChange],
  );
  const togglePw = useCallback(() => setShowPw((s) => !s), []);

  const resolvedType = isPassword ? (showPw ? 'text' : 'password') : type;

  return (
    <div className="relative">
      <div
        className={`input-wrapper group relative rounded-xl bg-[#f8f7f4] transition-all duration-300 ${
          error
            ? 'bg-red-50/60'
            : focused
              ? 'bg-[#f5f3ef]'
              : 'hover:bg-[#f6f5f1]'
        }`}
      >
        {/* Input element */}
        <input
          id={fieldId}
          type={resolvedType}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className={`
            peer relative z-10 block w-full bg-transparent
            px-4 pb-2 pt-6
            text-[15px] text-[#1a1a2e] placeholder-transparent
            outline-none
            transition-colors duration-200
            ${error ? 'text-red-700' : ''}
            ${className}
          `}
          {...inputProps}
        />

        {/* Label — floats up on focus / has-value */}
        <label
          htmlFor={fieldId}
          className={`
            absolute left-4 z-0 select-none
            transition-all duration-[280ms] cubic-bezier(0.22,1,0.36,1)
            pointer-events-none
            ${isFloating ? 'top-2 text-[11px] font-medium' : 'top-1/2 -translate-y-1/2 text-[15px]'}
            ${error ? 'text-red-500' : focused ? 'text-[#2d2b55]' : 'text-[#8a8a9a]'}
          `}
        >
          {label}
        </label>

        {/* Animated glow bar */}
        <div className="input-glow-bar" />

        {/* Icon (left side) */}
        {icon && (
          <div
            className={`
              pointer-events-none absolute left-4 top-1/2 z-20 -translate-y-1/2
              transition-all duration-[280ms] cubic-bezier(0.22,1,0.36,1)
              ${isFloating ? 'opacity-0 scale-75' : 'opacity-40'}
            `}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}

        {/* Password toggle */}
        {isPassword && hasValue && (
          <button
            type="button"
            onClick={togglePw}
            className="
              absolute right-3 top-1/2 z-20 -translate-y-1/2
              rounded-md p-1.5
              text-[#8a8a9a] hover:text-[#4a4a5a]
              transition-colors duration-200
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d2b55]/30
            "
            aria-label={showPw ? '隐藏密码' : '显示密码'}
            tabIndex={-1}
          >
            {showPw ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
          </button>
        )}

        {/* Error icon */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.2 }}
              className="absolute right-3 top-1/2 z-20 -translate-y-1/2 text-red-400"
              aria-hidden="true"
            >
              <AlertCircle size={18} strokeWidth={1.5} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error message */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.p
            id={`${fieldId}-error`}
            role="alert"
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mt-1.5 px-4 text-xs text-red-500"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
