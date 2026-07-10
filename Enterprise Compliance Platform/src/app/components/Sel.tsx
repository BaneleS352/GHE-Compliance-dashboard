import { FC, SelectHTMLAttributes } from "react";
import { inp } from "../../config/theme";

export interface SelProps extends SelectHTMLAttributes<HTMLSelectElement> {
  value: string;
  onChange: (value: string) => void;
}

export const Sel: FC<SelProps> = ({ value, onChange, className = "", ...props }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`${inp} ${className}`}
    {...props}
  />
);