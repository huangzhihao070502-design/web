import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

/* ─── Toast Context ─── */

interface ToastItem {
  id: string
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

interface ToastContextValue {
  toasts: ToastItem[]
  toast: (opts: Omit<ToastItem, "id">) => void
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within a ToastProvider")
  return ctx
}

/* ─── Provider ─── */

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback(
    (opts: Omit<ToastItem, "id">) => {
      const id = Math.random().toString(36).slice(2, 10)
      setToasts((prev) => [...prev, { ...opts, id }])
      setTimeout(() => dismiss(id), 3000)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}

      {/* Toast container — bottom-right fixed */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex min-w-[300px] max-w-[400px] items-start gap-3 rounded-sm bg-warm-white p-4 shadow-paper-md animate-in slide-in-from-right-2 fade-in-0",
              t.variant === "destructive" && "border border-cinnabar/20"
            )}
          >
            <div className="flex-1">
              {t.title && (
                <p className="text-sm font-medium text-ink">{t.title}</p>
              )}
              {t.description && (
                <p className="text-xs text-soft-ink">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="size-3.5" />
              <span className="sr-only">Dismiss</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/* ─── Imperative toast trigger ─── */

function Toast(
  props: Omit<ToastItem, "id"> & { children?: React.ReactNode }
) {
  const { toast: showToast } = useToast()

  return (
    <span
      data-slot="toast"
      onClick={() =>
        showToast({
          title: props.title,
          description: props.description,
          variant: props.variant,
        })
      }
    >
      {props.children}
    </span>
  )
}

export { ToastProvider, Toast, useToast }
