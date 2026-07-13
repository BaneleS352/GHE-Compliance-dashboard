import { FC, ReactElement, ReactNode } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";
import { inp } from "../../config/theme";

export interface SelProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  children?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
}

export const Sel: FC<SelProps> = ({ value, onChange, className = "", children, placeholder, disabled }) => {
  const options = extractOptions(children);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={`${inp} ${className}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt, i) => (
          <SelectItem key={i} value={opt.value ?? opt.label}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

function extractOptions(children: ReactNode): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  if (!children) return opts;
  const arr = Array.isArray(children) ? children : [children];
  for (const child of arr) {
    if (!child || typeof child !== "object") continue;
    const el = child as ReactElement<{ value?: string; children?: ReactNode }>;
    if (el.props?.value !== undefined) {
      opts.push({ value: el.props.value ?? "", label: extractText(el.props.children) });
    } else {
      opts.push({ value: extractText(el.props?.children), label: extractText(el.props?.children) });
    }
  }
  return opts;
}

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object") return "";
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (el.props?.children) return extractText(el.props.children);
  return "";
}
