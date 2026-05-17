import * as React from "react"
import { cn } from "../../lib/utils"

interface TabsContextValue {
  value?: string;
  setValue: (value: string) => void;
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabsContext(): TabsContextValue {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error("Tabs debe usarse dentro de Tabs")
  return context
}

export const Tabs = ({ defaultValue, value: controlledValue, onValueChange, className, children, ...props }: TabsProps) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue
  const setValue = (nextValue: string) => {
    if (!isControlled) setInternalValue(nextValue)
    onValueChange?.(nextValue)
  }
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={cn("", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-slate-800 p-1 text-slate-400",
      className
    )}
    {...props}
  />
))
TabsList.displayName = "TabsList"

export const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value: tabValue, ...props }, ref) => {
  const { value, setValue } = useTabsContext()
  const isActive = value === tabValue
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-slate-950 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive && "bg-slate-950 text-slate-50 shadow-sm",
        !isActive && "hover:bg-slate-800 hover:text-slate-50",
        className
      )}
      onClick={() => setValue(tabValue)}
      data-state={isActive ? "active" : "inactive"}
      {...props}
    />
  )
})
TabsTrigger.displayName = "TabsTrigger"

export const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value: tabValue, ...props }, ref) => {
  const { value } = useTabsContext()
  if (value !== tabValue) return null
  return (
    <div
      ref={ref}
      className={cn(
        "mt-2 ring-offset-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  )
})
TabsContent.displayName = "TabsContent"
