import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * shadcn/ui Avatar API without @radix-ui/react-avatar: the image shows once it
 * loads, the fallback until then (or when there is no src).
 */
const AvatarContext = React.createContext<{ loaded: string | null; setLoaded: (src: string | null) => void }>({ loaded: null, setLoaded: () => {} })

const Avatar = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(({ className, ...props }, ref) => {
  const [loaded, setLoaded] = React.useState<string | null>(null)
  return (
    <AvatarContext.Provider value={{ loaded, setLoaded }}>
      <span ref={ref} className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)} {...props} />
    </AvatarContext.Provider>
  )
})
Avatar.displayName = "Avatar"

const AvatarImage = React.forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(({ className, src, ...props }, ref) => {
  const { loaded, setLoaded } = React.useContext(AvatarContext)
  if (!src) return null
  return (
    <img
      ref={ref}
      src={src}
      onLoad={() => setLoaded(src)}
      onError={() => setLoaded(null)}
      className={cn("aspect-square h-full w-full object-cover object-top", loaded !== src && "absolute opacity-0", className)}
      {...props}
    />
  )
})
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(({ className, ...props }, ref) => {
  const { loaded } = React.useContext(AvatarContext)
  if (loaded != null) return null
  return <span ref={ref} className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)} {...props} />
})
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
