import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface TagProps extends React.ComponentProps<"span"> {
  onRemove?: () => void
}

function Tag({
  className,
  children,
  onRemove,
  ...props
}: TagProps) {
  return (
    <span
      data-slot="tag"
      className={cn(
        "inline-flex items-center gap-1 rounded-[6px] bg-mist px-2 py-0.5 text-xs text-deep-ink",
        className
      )}
      {...props}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 inline-flex size-3.5 items-center justify-center rounded-full hover:bg-soft-ink/20 transition-colors"
        >
          <X className="size-2.5" />
        </button>
      )}
    </span>
  )
}

export { Tag }
