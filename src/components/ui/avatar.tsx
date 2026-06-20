import * as React from "react"
import { cn } from "@/lib/utils"

interface AvatarProps extends React.ComponentProps<"div"> {
  size?: "sm" | "md" | "lg"
  src?: string
  alt?: string
  fallback?: string
}

function Avatar({
  className,
  size = "md",
  src,
  alt,
  fallback,
  ...props
}: AvatarProps) {
  const [error, setError] = React.useState(false)
  const sizeClasses: Record<string, string> = {
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-14 text-lg",
  }

  return (
    <div
      data-slot="avatar"
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-full border border-ink/10 bg-mist text-soft-ink",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {src && !error ? (
        <img
          src={src}
          alt={alt || ""}
          className="size-full object-cover"
          onError={() => setError(true)}
        />
      ) : fallback ? (
        <span className="select-none font-medium">{fallback}</span>
      ) : null}
    </div>
  )
}

export { Avatar }
