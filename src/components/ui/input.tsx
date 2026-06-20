import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full rounded-sm border border-mist bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-soft-ink/50 focus:border-copper focus:ring-2 focus:ring-copper/10 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
