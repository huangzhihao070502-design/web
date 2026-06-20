import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-[26px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border border-mist bg-light-gray transition-colors duration-200 data-[state=checked]:border-copper data-[state=checked]:bg-copper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/20 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block size-[22px] rounded-full bg-white shadow-paper-sm ring-0 transition-transform duration-200 data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-[1px]"
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = "Switch"

export { Switch }
