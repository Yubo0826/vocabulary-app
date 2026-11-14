import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,box-shadow,color] outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Material 3：滑鼠移上去疊 8% 的前景色（state layer），按下時 12%
        // filled
        default: "bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary),var(--primary-foreground)_8%)] hover:shadow-sm active:bg-[color-mix(in_srgb,var(--primary),var(--primary-foreground)_12%)]",
        // outlined
        outline:
          "border-border text-primary hover:bg-primary/8 active:bg-primary/12 aria-expanded:bg-primary/12",
        // filled tonal（secondary container）
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_srgb,var(--secondary),var(--secondary-foreground)_8%)] active:bg-[color-mix(in_srgb,var(--secondary),var(--secondary-foreground)_12%)] aria-expanded:bg-[color-mix(in_srgb,var(--secondary),var(--secondary-foreground)_12%)]",
        // text button／standard icon button：沒有底色，只有 state layer
        ghost:
          "hover:bg-foreground/8 active:bg-foreground/12 aria-expanded:bg-foreground/8",
        // filled tonal icon button（單字頁標題列的收藏、筆記、熟悉度）
        soft: "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_srgb,var(--secondary),var(--secondary-foreground)_8%)] active:bg-[color-mix(in_srgb,var(--secondary),var(--secondary-foreground)_12%)] aria-expanded:bg-[color-mix(in_srgb,var(--secondary),var(--secondary-foreground)_12%)]",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-full px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-full px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-full in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-full in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
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
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
