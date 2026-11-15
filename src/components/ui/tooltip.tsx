import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"
import { Z_INDEX } from "@/lib/zIndex"

const TooltipProvider = TooltipPrimitive.Provider
const TooltipRoot = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, children, style, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "w-max max-w-[20rem] overflow-hidden rounded-md border border-white/10 bg-black px-3 py-2 text-left text-xs leading-snug text-white shadow-xl whitespace-normal break-words",
        className
      )}
      style={{ zIndex: Z_INDEX.tooltip, ...style }}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="fill-black" width={8} height={6} />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export interface TooltipProps {
  content: React.ReactNode
  side?: "top" | "bottom" | "left" | "right" | "auto"
  className?: string
  /** vertical offset in pixels from the trigger to the tooltip (default 8) */
  offsetY?: number
  children: React.ReactNode
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  side = "top",
  className = "",
  children,
  offsetY = 14,
}) => {
  const wrapperRef = React.useRef<HTMLSpanElement | null>(null)
  const [expanded, setExpanded] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const closeTimerRef = React.useRef<number | null>(null)

  const clearTimer = React.useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  React.useEffect(() => () => clearTimer(), [clearTimer])

  const getLocalOffset = () => {
    let localOffset = offsetY
    if (wrapperRef.current) {
      const raw = wrapperRef.current.dataset.tooltipOffset
      if (raw) {
        const parsed = parseInt(raw, 10)
        if (!Number.isNaN(parsed)) localOffset = parsed
      }
    }
    return localOffset
  }

  const resolvedSide = side === "auto" ? "bottom" : side
  const sideOffset = side === "bottom" || side === "auto" ? getLocalOffset() + 6 : getLocalOffset()

  const trigger = React.isValidElement(children)
    ? children
    : (
        <span tabIndex={0} className="inline-flex">
          {children}
        </span>
      )

  return (
    <TooltipProvider delayDuration={0} skipDelayDuration={0}>
      <TooltipRoot
        open={open}
        onOpenChange={(next) => {
          if (!next && expanded) {
            clearTimer()
            closeTimerRef.current = window.setTimeout(() => {
              setOpen(false)
              setExpanded(false)
            }, 1500)
            return
          }
          if (next) clearTimer()
          setOpen(next)
          if (!next) setExpanded(false)
        }}
      >
        <TooltipTrigger asChild>
          <span
            ref={wrapperRef}
            className={cn("relative inline-flex", className)}
            onClick={(event) => {
              if (event.target !== event.currentTarget) return
              setExpanded((current) => !current)
              setOpen(true)
            }}
          >
            {trigger}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side={resolvedSide}
          sideOffset={sideOffset}
          onPointerEnter={() => {
            if (expanded) {
              clearTimer()
              setOpen(true)
            }
          }}
          onPointerLeave={() => {
            if (!expanded) return
            clearTimer()
            closeTimerRef.current = window.setTimeout(() => {
              setOpen(false)
              setExpanded(false)
            }, 1500)
          }}
        >
          {content}
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  )
}

export default Tooltip
export { Tooltip, TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent }
