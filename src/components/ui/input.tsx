import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldWidthClass, type FieldWidth } from "@/components/ui/fieldWidth"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Content-sized width. Numbers default to `num`; other inputs default to `name`. */
  width?: FieldWidth;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, width, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          fieldWidthClass(width, type),
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
