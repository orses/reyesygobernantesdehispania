import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "../../lib/utils"

const Checkbox = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { checked?: boolean; onCheckedChange?: (checked: boolean) => void }
>(({ className, checked, onCheckedChange, ...props }, ref) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    ref={ref}
    onClick={() => onCheckedChange?.(!checked)}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-slate-700 ring-offset-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-slate-950 data-[state=unchecked]:bg-slate-950",
      className
    )}
    data-state={checked ? "checked" : "unchecked"}
    {...props}
  >
    {checked && (
      <div className={cn("flex items-center justify-center text-current")}>
        <Check className="h-3 w-3" />
      </div>
    )}
  </button>
))
Checkbox.displayName = "Checkbox"

export { Checkbox }