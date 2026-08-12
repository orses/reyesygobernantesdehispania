import * as React from "react"
import { getHorizontalNavigationIndex } from "../../lib/accessibility"
import { cn } from "../../lib/utils"

interface TabsContextValue {
  value?: string;
  setValue: (value: string) => void;
  baseId: string;
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
  const baseId = React.useId()
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue
  const setValue = (nextValue: string) => {
    if (!isControlled) setInternalValue(nextValue)
    onValueChange?.(nextValue)
  }
  return (
    <TabsContext.Provider value={{ value, setValue, baseId }}>
      <div className={cn("", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, onKeyDown, ...props }, ref) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented) return

    const target = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('[role="tab"]')
      : null
    if (!target) return

    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')
    )
    const nextIndex = getHorizontalNavigationIndex(
      tabs.indexOf(target),
      tabs.length,
      event.key
    )
    if (nextIndex === null) return

    event.preventDefault()
    tabs[nextIndex]?.focus()
    tabs[nextIndex]?.click()
  }

  return (
    <div
      {...props}
      ref={ref}
      role="tablist"
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-slate-800 p-1 text-slate-400",
        className
      )}
      onKeyDown={handleKeyDown}
    />
  )
})
TabsList.displayName = "TabsList"

export const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value: tabValue, ...props }, ref) => {
  const { value, setValue, baseId } = useTabsContext()
  const isActive = value === tabValue
  const triggerId = `${baseId}-tab-${tabValue}`
  const panelId = `${baseId}-panel-${tabValue}`
  const { onClick, id, ...buttonProps } = props
  return (
    <button
      {...buttonProps}
      ref={ref}
      type="button"
      id={id ?? triggerId}
      role="tab"
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-slate-950 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive && "bg-slate-950 text-slate-50 shadow-sm",
        !isActive && "hover:bg-slate-800 hover:text-slate-50",
        className
      )}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) setValue(tabValue)
      }}
      data-state={isActive ? "active" : "inactive"}
    />
  )
})
TabsTrigger.displayName = "TabsTrigger"

export const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value: tabValue, ...props }, ref) => {
  const { value, baseId } = useTabsContext()
  if (value !== tabValue) return null
  const { id, ...contentProps } = props
  return (
    <div
      {...contentProps}
      ref={ref}
      id={id ?? `${baseId}-panel-${tabValue}`}
      role="tabpanel"
      aria-labelledby={`${baseId}-tab-${tabValue}`}
      tabIndex={0}
      className={cn(
        "mt-2 ring-offset-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
        className
      )}
    />
  )
})
TabsContent.displayName = "TabsContent"
