import React from "react";
import * as Select from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { sel } from "../../config/theme";

export function Sel({
  children,
  value,
  onChange,
  className = "",
}: {
  children: React.ReactNode;
  value?: string;
  onChange?: (v: string) => void;
  className?: string;
}) {
  const options = React.Children.toArray(children)
    .map((child) => {
      if (
      React.isValidElement<React.OptionHTMLAttributes<HTMLOptionElement>>(child) &&
      child.type === "option"
    )  {
        const val = (
          child.props.value !== undefined ? child.props.value : child.props.children
        ) as string;
        return { value: val === "" ? "__placeholder__" : val, label: child.props.children };
      }
      return null;
    })
    .filter(Boolean) as { value: string; label: React.ReactNode }[];

  const safeValue = value === "" ? "__placeholder__" : value;
  const selectedLabel =
    options.find((o) => o.value === safeValue)?.label || options[0]?.label;

  return (
    <Select.Root
      value={safeValue}
      onValueChange={(v) => onChange?.(v === "__placeholder__" ? "" : v)}
    >
      <Select.Trigger
        className={`${sel} flex items-center justify-between group ${className}`}
      >
        <Select.Value>{selectedLabel}</Select.Value>
        <Select.Icon>
          <ChevronDown
            size={15}
            className="text-slate-400 group-hover:text-purple-500 transition-colors"
          />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 w-[var(--radix-select-trigger-width)]"
        >
          <Select.Viewport className="p-1.5">
            {options.map((opt, i) => (
              <Select.Item
                key={i}
                value={opt.value}
                className="text-sm font-medium text-slate-700 px-3 py-2.5 rounded-lg cursor-pointer outline-none data-[highlighted]:bg-yellow-400 data-[highlighted]:text-yellow-950 transition-colors"
              >
                <Select.ItemText>{opt.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
