import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { normalizeSearchText } from "../../lib/text";
import { cn } from "../../lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  keywords?: readonly string[];
  disabled?: boolean;
}

interface ComboboxProps<Option extends ComboboxOption = ComboboxOption> {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  clearValue?: string;
  clearLabel?: string;
  maxVisibleOptions?: number;
  className?: string;
  renderOption?: (
    option: Option,
    state: { active: boolean; selected: boolean }
  ) => React.ReactNode;
}

interface PopoverPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "top" | "bottom";
}

const DEFAULT_MAX_VISIBLE_OPTIONS = 80;
const MAX_POPOVER_HEIGHT = 360;
const VIEWPORT_MARGIN = 8;

function comboboxSearchText(option: ComboboxOption): string {
  return normalizeSearchText([option.label, ...(option.keywords ?? [])].join(" "));
}

function comboboxSearchTokens(query: string): string[] {
  return normalizeSearchText(query).split(/\s+/).filter(Boolean);
}

function matchesComboboxQuery(option: ComboboxOption, tokens: string[]): boolean {
  if (!tokens.length) return true;

  const text = comboboxSearchText(option);
  return tokens.every((token) => text.includes(token));
}

export function filterComboboxOptions<Option extends ComboboxOption>(
  options: readonly Option[],
  query: string
): Option[] {
  const tokens = comboboxSearchTokens(query);
  return options.filter((option) => matchesComboboxQuery(option, tokens));
}

function firstEnabledIndex(options: readonly ComboboxOption[]): number {
  return options.findIndex((option) => !option.disabled);
}

function lastEnabledIndex(options: readonly ComboboxOption[]): number {
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index].disabled) return index;
  }

  return -1;
}

function nextEnabledIndex(
  options: readonly ComboboxOption[],
  currentIndex: number,
  direction: 1 | -1
): number {
  if (!options.length) return -1;

  let nextIndex = currentIndex < 0 ? (direction > 0 ? -1 : 0) : currentIndex;
  for (let step = 0; step < options.length; step += 1) {
    nextIndex = (nextIndex + direction + options.length) % options.length;
    if (!options[nextIndex].disabled) return nextIndex;
  }

  return -1;
}

export function Combobox<Option extends ComboboxOption = ComboboxOption>({
  value,
  onValueChange,
  options,
  placeholder = "Selecciona una opción",
  searchPlaceholder = "Buscar",
  emptyMessage = "Sin resultados",
  clearValue,
  clearLabel = "Limpiar selección",
  maxVisibleOptions = DEFAULT_MAX_VISIBLE_OPTIONS,
  className,
  renderOption,
}: ComboboxProps<Option>) {
  const reactId = React.useId();
  const listboxId = `${reactId}-listbox`;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listboxRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [position, setPosition] = React.useState<PopoverPosition | null>(null);

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );
  const selectedLabel = selectedOption?.label ?? (value ? value : "");
  const filteredOptions = React.useMemo(
    () => filterComboboxOptions(options, query),
    [options, query]
  );
  const visibleLimit = Math.max(1, maxVisibleOptions);
  const visibleOptions = React.useMemo(
    () => filteredOptions.slice(0, visibleLimit),
    [filteredOptions, visibleLimit]
  );
  const hiddenOptionsCount = Math.max(0, filteredOptions.length - visibleOptions.length);
  const hiddenOptionsLabel =
    hiddenOptionsCount === 1
      ? "1 coincidencia más"
      : `${hiddenOptionsCount} coincidencias más`;
  const inputValue = open ? query : selectedLabel;
  const activeOptionId =
    open && activeIndex >= 0 && visibleOptions[activeIndex]
      ? `${listboxId}-option-${activeIndex}`
      : undefined;
  const hasClearButton = clearValue !== undefined && value !== clearValue;

  const updatePopoverPosition = React.useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const rect = root.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    const openAbove = spaceBelow < 260 && spaceAbove > spaceBelow;
    const availableHeight = Math.max(VIEWPORT_MARGIN, openAbove ? spaceAbove : spaceBelow);
    const maxHeight = Math.min(MAX_POPOVER_HEIGHT, availableHeight);
    const safeWidth = Math.min(rect.width, window.innerWidth - VIEWPORT_MARGIN * 2);
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.left),
      window.innerWidth - safeWidth - VIEWPORT_MARGIN
    );
    const top = openAbove ? rect.top - 4 : rect.bottom + 4;

    setPosition({
      top,
      left,
      width: safeWidth,
      maxHeight,
      placement: openAbove ? "top" : "bottom",
    });
  }, []);

  const closeCombobox = React.useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }, []);

  const openCombobox = React.useCallback(() => {
    setQuery("");
    setOpen(true);
  }, []);

  const selectOption = React.useCallback(
    (option: Option) => {
      if (option.disabled) return;

      onValueChange(option.value);
      closeCombobox();
    },
    [closeCombobox, onValueChange]
  );

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return undefined;

    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);

    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [open, updatePopoverPosition, visibleOptions.length]);

  React.useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listboxRef.current?.contains(target)) {
        return;
      }

      closeCombobox();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [closeCombobox, open]);

  React.useEffect(() => {
    if (!open) return;

    const selectedIndex = visibleOptions.findIndex(
      (option) => option.value === value && !option.disabled
    );
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(visibleOptions));
  }, [open, value, visibleOptions]);

  React.useEffect(() => {
    if (!open || activeIndex < 0) return;

    document
      .getElementById(`${listboxId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listboxId, open]);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) openCombobox();
      setActiveIndex((current) => nextEnabledIndex(visibleOptions, current, 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openCombobox();
      setActiveIndex((current) => nextEnabledIndex(visibleOptions, current, -1));
      return;
    }

    if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(firstEnabledIndex(visibleOptions));
      return;
    }

    if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(lastEnabledIndex(visibleOptions));
      return;
    }

    if (event.key === "Enter") {
      if (!open) {
        event.preventDefault();
        openCombobox();
        return;
      }

      const option = visibleOptions[activeIndex];
      if (option) {
        event.preventDefault();
        selectOption(option);
      }
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeCombobox();
    }
  };

  const popover =
    mounted && open && position
      ? createPortal(
          <div
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              transform:
                position.placement === "top" ? "translateY(-100%)" : undefined,
            }}
            className="fixed z-[100] overflow-auto rounded-[3px] border border-slate-700 bg-slate-950 p-1 text-slate-50 shadow-xl shadow-slate-950/40"
          >
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option, index) => {
                const selected = option.value === value;
                const active = index === activeIndex;

                return (
                  <div
                    key={option.value}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-disabled={option.disabled}
                    aria-selected={selected}
                    className={cn(
                      "flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-[3px] px-2.5 py-2 text-sm outline-none",
                      "text-slate-100 hover:bg-slate-800",
                      active && "bg-slate-800 text-slate-50",
                      selected && "text-emerald-100",
                      option.disabled && "pointer-events-none opacity-50"
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectOption(option);
                    }}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {selected ? <Check className="h-4 w-4" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      {renderOption ? (
                        renderOption(option, { active, selected })
                      ) : (
                        <span className="block truncate">{option.label}</span>
                      )}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-2 text-sm text-slate-400">{emptyMessage}</div>
            )}

            {hiddenOptionsCount > 0 ? (
              <div className="border-t border-slate-800 px-3 py-2 text-xs text-slate-400">
                {hiddenOptionsLabel}
              </div>
            ) : null}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
        aria-activedescendant={activeOptionId}
        autoComplete="off"
        className={cn(
          "flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 py-2 pl-9 pr-16 text-sm ring-offset-slate-950",
          "text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
          className
        )}
        placeholder={open ? searchPlaceholder : placeholder}
        value={inputValue}
        onFocus={openCombobox}
        onClick={() => {
          if (!open) openCombobox();
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={handleInputKeyDown}
      />
      {hasClearButton ? (
        <button
          type="button"
          aria-label={clearLabel}
          className="absolute right-9 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[3px] text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onValueChange(clearValue);
            closeCombobox();
            inputRef.current?.focus();
          }}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      <button
        type="button"
        aria-label={open ? "Cerrar opciones" : "Abrir opciones"}
        className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[3px] text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open) {
            closeCombobox();
          } else {
            openCombobox();
            inputRef.current?.focus();
          }
        }}
      >
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {popover}
    </div>
  );
}
