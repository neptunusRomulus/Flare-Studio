import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Minimal shadcn-style Popover (no @radix-ui/react-popover dependency).
 * Content renders under the trigger, closes on outside click or Escape.
 */
type Ctx = { open: boolean; setOpen: (v: boolean) => void }
const PopoverContext = React.createContext<Ctx>({ open: false, setOpen: () => {} })

function Popover({ open: controlled, onOpenChange, children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }) {
  const [inner, setInner] = React.useState(false)
  const open = controlled ?? inner
  const setOpen = React.useCallback((v: boolean) => { setInner(v); onOpenChange?.(v) }, [onOpenChange])
  const ref = React.useRef<HTMLSpanElement>(null)
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey) }
  }, [open, setOpen])
  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <span ref={ref} className="relative inline-flex">{children}</span>
    </PopoverContext.Provider>
  )
}

function PopoverTrigger({ children }: { children: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }> }) {
  const { open, setOpen } = React.useContext(PopoverContext)
  return React.cloneElement(children, {
    onClick: (e: React.MouseEvent) => { children.props.onClick?.(e); setOpen(!open) },
  })
}

function PopoverContent({ className, align = "center", side = "bottom", ...props }: React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "center" | "end"; side?: "top" | "bottom" }) {
  const { open } = React.useContext(PopoverContext)
  if (!open) return null
  return (
    <div
      className={cn(
        "absolute z-40 w-64 rounded-md border bg-popover p-2 text-popover-foreground shadow-md",
        side === "bottom" ? "top-full mt-1" : "bottom-full mb-1",
        align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2",
        className
      )}
      {...props}
    />
  )
}

export { Popover, PopoverTrigger, PopoverContent }
