import { ChevronDown, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type ComboOption = { value: string; label: string; icon?: LucideIcon };

type ComboBoxProps = {
  value: string;
  options: ComboOption[];
  onChange: (value: string) => void;
  variant?: "pill" | "field";
  width?: number | string;
  placeholder?: string;
};

export default function ComboBox({
  value,
  options,
  onChange,
  variant = "field",
  width,
  placeholder = "Select",
}: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((item) => item.value === value);
  const SelectedIcon = selected?.icon;

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className={`combo ${variant}`} ref={rootRef} style={{ width }}>
      <button
        type="button"
        className={`combo-trigger${open ? " open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="combo-label">
          {SelectedIcon && <SelectedIcon className="combo-ico" size={16} strokeWidth={1.6} />}
          {selected?.label || placeholder}
        </span>
        <ChevronDown className="combo-caret" size={15} strokeWidth={1.6} />
      </button>
      {open && (
        <div className="combo-menu" role="listbox" id={listId}>
          {options.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={item.value === value}
                className={`combo-item${item.value === value ? " on" : ""}`}
                onClick={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
              >
                {Icon && <Icon className="combo-ico" size={16} strokeWidth={1.6} />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
