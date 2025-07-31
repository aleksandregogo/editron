import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-button hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
        outline:
          "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
        secondary:
          "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
        ghost: "hover:bg-neutral-100 hover:text-neutral-900",
        link: "text-primary-600 underline-offset-4 hover:underline hover:text-primary-700",
        gradient: "bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-button hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 py-3 text-base font-semibold",
        xl: "h-14 rounded-lg px-10 py-4 text-lg font-semibold",
        icon: "h-10 w-10",
        xs: "h-7 px-2 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants } 