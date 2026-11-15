import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"
import { Z_INDEX } from "@/lib/zIndex"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>
>(({ asChild = true, ...props }, ref) => (
  <PopoverPrimitive.Trigger ref={ref} asChild={asChild} {...props} />
))
PopoverTrigger.displayName = PopoverPrimitive.Trigger.displayName

const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", side = "bottom", sideOffset = 4, style, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      side={side}
      sideOffset={sideOffset}
      className={cn(
        "w-64 rounded-md border bg-popover p-2 text-popover-foreground shadow-md outline-none",
        className
      )}
      style={{ zIndex: Z_INDEX.popover, ...style }}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent }
