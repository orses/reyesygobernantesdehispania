import * as React from "react"
import { X } from "lucide-react"
import { shouldDismissDialogOnEscape } from "../../lib/accessibility"
import { cn } from "../../lib/utils"

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

const DialogContext = React.createContext<{
  open?: boolean
  onOpenChange?: (open: boolean) => void
  titleId?: string
  descriptionId?: string
}>({})

export const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  const baseId = React.useId()
  const titleId = `${baseId}-dialog-title`
  const descriptionId = `${baseId}-dialog-description`
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open || !containerRef.current) return

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const dialog = containerRef.current.querySelector<HTMLElement>('[role="dialog"]')
    if (!dialog) return

    const focusableSelector = [
      "button:not(:disabled)",
      "input:not(:disabled)",
      "select:not(:disabled)",
      "textarea:not(:disabled)",
      "a[href]",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",")
    const focusableElements = () => Array.from(
      dialog.querySelectorAll<HTMLElement>(focusableSelector)
    ).filter((element) => element.getAttribute("aria-hidden") !== "true")

    const initialFocus = focusableElements()[0] ?? dialog
    initialFocus.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldDismissDialogOnEscape(event.key, event.defaultPrevented)) {
        event.preventDefault()
        onOpenChange?.(false)
        return
      }
      if (event.defaultPrevented) return
      if (event.key !== "Tab") return

      const elements = focusableElements()
      if (elements.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      previousFocus?.focus()
    }
  }, [onOpenChange, open])

  return (
    <DialogContext.Provider value={{ open, onOpenChange, titleId, descriptionId }}>
      {open && (
        <div ref={containerRef} className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8">
           <div 
             className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-all" 
             aria-hidden="true"
             onClick={() => onOpenChange?.(false)}
           />
           {children}
        </div>
      )}
    </DialogContext.Provider>
  )
}

export const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, "aria-labelledby": labelledBy, "aria-describedby": describedBy, ...props }, ref) => {
    const { onOpenChange, titleId, descriptionId } = React.useContext(DialogContext)
    return (
      <div
        {...props}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? titleId}
        aria-describedby={describedBy ?? descriptionId}
        tabIndex={-1}
        className={cn(
          "relative z-50 grid w-full max-w-lg gap-4 border border-slate-800 bg-slate-950 p-6 shadow-lg duration-200 sm:rounded-lg",
          className
        )}
      >
        {children}
        <button
          type="button"
          aria-label="Cerrar diálogo"
          onClick={() => onOpenChange?.(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-slate-950 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-slate-800 data-[state=open]:text-slate-400"
        >
          <X className="h-4 w-4 text-slate-100" aria-hidden="true" />
          <span className="sr-only">Cerrar diálogo</span>
        </button>
      </div>
    )
  }
)
DialogContent.displayName = "DialogContent"

export const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

export const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, id, ...props }, ref) => {
  const { titleId } = React.useContext(DialogContext)
  return (
    <h2
      {...props}
      ref={ref}
      id={id ?? titleId}
      className={cn(
        "text-lg font-medium leading-none tracking-tight text-slate-50",
        className
      )}
    />
  )
})
DialogTitle.displayName = "DialogTitle"

export const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, id, ...props }, ref) => {
  const { descriptionId } = React.useContext(DialogContext)
  return (
    <p
      {...props}
      ref={ref}
      id={id ?? descriptionId}
      className={cn("text-sm text-slate-400", className)}
    />
  )
})
DialogDescription.displayName = "DialogDescription"
