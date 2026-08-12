import * as React from "react"
import { ChevronDown, Check } from "lucide-react"
import {
  getVerticalNavigationIndex,
  isKeyboardActivation,
} from "../../lib/accessibility"
import { cn } from "../../lib/utils"

interface SelectContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  triggerId: string;
  listboxId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

type SelectTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>;
type SelectContentProps = React.HTMLAttributes<HTMLDivElement>;

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}

interface SelectValueProps {
  placeholder?: React.ReactNode;
  children?: React.ReactNode;
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext(): SelectContextValue {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error("Select debe usarse dentro de Select")
  return context
}

export const Select = ({ value, onValueChange, defaultOpen = false, children }: SelectProps) => {
  const [open, setOpen] = React.useState(defaultOpen)
  const baseId = React.useId()
  const triggerId = `${baseId}-select-trigger`
  const listboxId = `${baseId}-select-listbox`
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  return (
    <SelectContext.Provider value={{
      value,
      onValueChange,
      open,
      setOpen,
      triggerId,
      listboxId,
      triggerRef,
    }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  )
}

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null): void {
  if (typeof ref === "function") ref(value)
  else if (ref) ref.current = value
}

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, onClick, onKeyDown, id, ...props }, forwardedRef) => {
    const { open, setOpen, triggerId, listboxId, triggerRef } = useSelectContext()

    return (
      <button
        {...props}
        ref={(element) => {
          triggerRef.current = element
          assignRef(forwardedRef, element)
        }}
        id={id ?? triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={(event) => {
          onClick?.(event)
          if (!event.defaultPrevented) setOpen((current) => !current)
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented) return
          if (event.key === "Escape" && open) {
            event.preventDefault()
            setOpen(false)
            return
          }
          if (
            event.key === "ArrowDown" ||
            event.key === "ArrowUp" ||
            isKeyboardActivation(event.key)
          ) {
            event.preventDefault()
            setOpen(true)
          }
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm ring-offset-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left">{children}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50 text-slate-100" aria-hidden="true" />
      </button>
    )
  }
)
SelectTrigger.displayName = "SelectTrigger"

export const SelectContent = ({ className, children, onKeyDown, id, ...props }: SelectContentProps) => {
  const { open, setOpen, triggerId, listboxId, triggerRef } = useSelectContext()
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open, setOpen, triggerRef])

  React.useEffect(() => {
    if (!open || !ref.current) return
    const options = Array.from(
      ref.current.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])')
    )
    const selected = options.find((option) => option.getAttribute("aria-selected") === "true")
    const optionToFocus = selected ?? options[0]
    optionToFocus?.focus()
  }, [open])

  if (!open) return null

  return (
    <div
      {...props}
      ref={ref}
      id={id ?? listboxId}
      role="listbox"
      aria-labelledby={triggerId}
      className={cn(
        "absolute z-50 mt-1 max-h-96 w-max min-w-[var(--trigger-width,100%)] overflow-auto rounded-md border border-slate-700 bg-slate-950 text-slate-50 shadow-md animate-in fade-in-80",
        className
      )}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented) return

        if (event.key === "Escape") {
          event.preventDefault()
          setOpen(false)
          triggerRef.current?.focus()
          return
        }

        const options = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])')
        )
        const activeOption = event.target instanceof Element
          ? event.target.closest<HTMLElement>('[role="option"]')
          : null
        if (activeOption && isKeyboardActivation(event.key)) {
          event.preventDefault()
          activeOption.click()
          return
        }

        const nextIndex = getVerticalNavigationIndex(
          activeOption ? options.indexOf(activeOption) : -1,
          options.length,
          event.key
        )
        if (nextIndex === null) return
        event.preventDefault()
        options[nextIndex]?.focus()
      }}
    >
      <div className="p-1">{children}</div>
    </div>
  )
}

export const SelectItem = ({ className, children, value, disabled = false, onClick, ...props }: SelectItemProps) => {
  const { value: selectedValue, onValueChange, setOpen, triggerRef } = useSelectContext()
  const isSelected = selectedValue === value

  return (
    <div
      {...props}
      role="option"
      aria-selected={isSelected}
      tabIndex={disabled ? -1 : isSelected ? 0 : -1}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-slate-800 hover:text-slate-50 focus:bg-slate-800 focus:text-slate-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        if (disabled) return
        event.stopPropagation()
        onValueChange?.(value)
        setOpen(false)
        triggerRef.current?.focus()
      }}
      aria-disabled={disabled}
      data-disabled={disabled ? "" : undefined}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected && <Check className="h-4 w-4" aria-hidden="true" />}
      </span>
      <span className="whitespace-nowrap">{children}</span>
    </div>
  )
}

export const SelectValue = ({ placeholder, children }: SelectValueProps) => {
  const { value } = useSelectContext()
  return <span>{children || (value === "" || value === undefined ? placeholder : value)}</span>
}
