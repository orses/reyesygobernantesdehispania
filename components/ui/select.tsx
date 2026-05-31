import * as React from "react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "../../lib/utils"

interface SelectContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
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

export const Select = ({ value, onValueChange, children }: SelectProps) => {
  const [open, setOpen] = React.useState(false)
  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  )
}

export const SelectTrigger = ({ className, children, ...props }: SelectTriggerProps) => {
  const { open, setOpen } = useSelectContext()
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm ring-offset-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-50 text-slate-100" />
    </button>
  )
}

export const SelectContent = ({ className, children, ...props }: SelectContentProps) => {
  const { open, setOpen } = useSelectContext()
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open, setOpen])

  if (!open) return null

  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 mt-1 max-h-96 w-max min-w-[var(--trigger-width,100%)] overflow-auto rounded-md border border-slate-700 bg-slate-950 text-slate-50 shadow-md animate-in fade-in-80",
        className
      )}
      {...props}
    >
      <div className="p-1">{children}</div>
    </div>
  )
}

export const SelectItem = ({ className, children, value, disabled = false, ...props }: SelectItemProps) => {
  const { value: selectedValue, onValueChange, setOpen } = useSelectContext()
  const isSelected = selectedValue === value

  return (
    <div
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-slate-800 hover:text-slate-50 focus:bg-slate-800 focus:text-slate-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      onClick={(event) => {
        if (disabled) return
        event.stopPropagation()
        onValueChange?.(value)
        setOpen(false)
      }}
      aria-disabled={disabled}
      data-disabled={disabled ? "" : undefined}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected && <Check className="h-4 w-4" />}
      </span>
      <span className="whitespace-nowrap">{children}</span>
    </div>
  )
}

export const SelectValue = ({ placeholder, children }: SelectValueProps) => {
  const { value } = useSelectContext()
  return <span>{children || (value === "" || value === undefined ? placeholder : value)}</span>
}
