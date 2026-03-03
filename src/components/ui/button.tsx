import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent-primary)] text-[var(--primary-foreground)] hover:bg-[#E3E3E3]",
        destructive:
          "bg-[rgba(232,92,74,0.10)] text-[var(--danger)] border border-[rgba(232,92,74,0.20)] hover:bg-[rgba(232,92,74,0.20)]",
        outline:
          "bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
        secondary:
          "bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
        ghost:
          "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[44px] md:min-h-8 md:h-8 px-4 py-2 has-[>svg]:px-3",
        sm: "min-h-[44px] md:min-h-8 md:h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "min-h-[48px] md:min-h-10 md:h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "min-h-[44px] min-w-[44px] md:min-h-9 md:min-w-9 md:size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
