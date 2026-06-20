import * as React from "react"
import { cn } from "@/lib/utils"
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card" className={cn("rounded-2xl bg-warm-white p-5 shadow-paper-sm", className)} {...props} />
}
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("mb-4", className)} {...props} />
}
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("", className)} {...props} />
}
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("mt-4 flex items-center border-t border-mist pt-4", className)} {...props} />
}
export { Card, CardHeader, CardContent, CardFooter }
