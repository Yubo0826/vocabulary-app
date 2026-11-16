"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Tabs as TabsPrimitive } from "radix-ui"

// 使用者切換過分頁後才加上 data-animated，內容的滑入動畫只在切換時播放、首次載入不播
function Tabs({
  className,
  orientation = "horizontal",
  onValueChange,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [animated, setAnimated] = React.useState(false)
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      data-animated={animated ? "" : undefined}
      orientation={orientation}
      onValueChange={(value) => {
        setAnimated(true)
        onValueChange?.(value)
      }}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

// Material 3 的 primary tabs：整排分隔線，選中的分頁文字變主色、下方 3px 圓頭指示條
const tabsListVariants = cva(
  "group/tabs-list relative inline-flex items-center text-muted-foreground group-data-horizontal/tabs:h-12 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "w-full border-b",
        line: "w-fit gap-1",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// 水平分頁的指示條是 TabsList 裡的單一元素，量出選中分頁的中心點後滑過去；
// 量到之前（伺服器渲染、hydration 前）先用各分頁自己的 ::after 顯示
function TabsList({
  className,
  variant = "default",
  ref,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const [center, setCenter] = React.useState<number | null>(null)

  React.useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const update = () => {
      const active = list.querySelector<HTMLElement>(
        '[data-slot="tabs-trigger"][data-state="active"]'
      )
      const horizontal = list.getAttribute("aria-orientation") !== "vertical"
      setCenter(active && horizontal ? active.offsetLeft + active.offsetWidth / 2 : null)
    }
    update()
    const mo = new MutationObserver(update)
    mo.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-state"] })
    const ro = new ResizeObserver(update)
    ro.observe(list)
    return () => {
      mo.disconnect()
      ro.disconnect()
    }
  }, [])

  return (
    <TabsPrimitive.List
      ref={(node) => {
        listRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) ref.current = node
      }}
      data-slot="tabs-list"
      data-variant={variant}
      data-indicator={center !== null ? "ready" : undefined}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {props.children}
      {center !== null && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 h-[3px] w-14 -translate-x-1/2 rounded-t-full bg-primary transition-[left] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none"
          style={{ left: center }}
        />
      )}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-full flex-1 items-center justify-center gap-1.5 px-4 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:bg-foreground/8 hover:text-foreground focus-visible:bg-foreground/10 disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "data-active:text-primary data-active:hover:text-primary",
        "after:absolute after:bg-primary after:opacity-0 after:transition-opacity data-active:after:opacity-100 group-data-horizontal/tabs:after:bottom-0 group-data-horizontal/tabs:after:left-1/2 group-data-horizontal/tabs:after:h-[3px] group-data-horizontal/tabs:after:w-14 group-data-horizontal/tabs:after:-translate-x-1/2 group-data-horizontal/tabs:after:rounded-t-full group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5",
        "group-data-[indicator=ready]/tabs-list:after:hidden",
        className
      )}
      {...props}
    />
  )
}

// 切換後的滑入方向由使用端用 slide-in-from-* 指定（例如左邊分頁 slide-in-from-left-8）
function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "flex-1 text-sm outline-none",
        "group-data-animated/tabs:motion-safe:animate-in group-data-animated/tabs:motion-safe:fade-in-0 group-data-animated/tabs:motion-safe:duration-300 group-data-animated/tabs:motion-safe:ease-[cubic-bezier(0.2,0,0,1)]",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
