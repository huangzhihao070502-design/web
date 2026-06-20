import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[80px] w-full rounded-sm border border-mist bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-soft-ink/50 focus:border-copper focus:ring-2 focus:ring-copper/10 resize-y disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
