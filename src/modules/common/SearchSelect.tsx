import { useMemo, useState } from "react";

export type SearchSelectItem = {
  id: string;
  label: string;
};

type Props = {
  items: SearchSelectItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  allLabel?: string; // if provided, shows "all/empty" option
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

export function SearchSelect({
  items,
  value,
  onChange,
  placeholder = "Escriba para buscar...",
  allLabel,
  disabled,
  required,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedLabel = useMemo(() => {
    if (!value) return "";
    return items.find((i) => i.id === value)?.label ?? "";
  }, [items, value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
    return base.slice(0, 60);
  }, [items, search]);

  return (
    <div className="relative">
      <input
        type="text"
        className={className}
        placeholder={placeholder}
        value={value ? selectedLabel : search}
        disabled={disabled}
        onChange={(e) => {
          setSearch(e.target.value);
          if (value) onChange("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {required && <input type="hidden" value={value} required />}
      {open && !disabled && (
        <div className="absolute z-20 w-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 max-h-56 overflow-y-auto">
          {allLabel && (
            <button
              type="button"
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-agro-primary/10 transition-colors border-b border-gray-50"
              onClick={() => {
                onChange("");
                setSearch("");
                setOpen(false);
              }}
            >
              {allLabel}
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">Sin resultados</div>
          ) : (
            filtered.map((it) => (
              <button
                key={it.id}
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-agro-primary/10 transition-colors border-b border-gray-50 last:border-0"
                onClick={() => {
                  onChange(it.id);
                  setSearch(it.label);
                  setOpen(false);
                }}
              >
                {it.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

