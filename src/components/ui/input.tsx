import * as React from "react"
import { cn } from "@/lib/utils"
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn("h-9 w-full rounded-xl border border-mist bg-transparent px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-soft-ink/40 focus:border-copper/40 focus:ring-2 focus:ring-copper/10 disabled:opacity-50", className)} {...props} />
}
export { Input }
