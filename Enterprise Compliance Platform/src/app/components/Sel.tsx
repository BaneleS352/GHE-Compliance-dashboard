import React, { FC, ReactElement, ReactNode } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";
import { inp } from "@/config/theme";

export interface SelProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  children?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
}

type OptionProps = {
  value?: string;
  children?: ReactNode;
};

export const Sel: FC<SelProps> = ({
  value,
  onChange,
  className = "",
  children,
  placeholder,
  disabled,
}) => {
  const options = extractOptions(children);

  const placeholderText =
    placeholder ??
    options.find((o) => o.value === "")?.label ??
    "Select...";

  const items = options.filter((o) => o.value !== "");

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger className={`${inp} ${className}`}>
        <SelectValue placeholder={placeholderText} />
      </SelectTrigger>

      <SelectContent>
        {items.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

function extractOptions(
  children: ReactNode
): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;

    const element = child as ReactElement<OptionProps>;

    const value =
      element.props.value !== undefined
        ? String(element.props.value)
        : extractText(element.props.children);

    const label = extractText(element.props.children);

    opts.push({
      value,
      label,
    });
  });

  return opts;
}

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }

  if (React.isValidElement(node)) {
    const element = node as ReactElement<{
      children?: ReactNode;
    }>;

    return extractText(element.props.children);
  }

  return "";
}