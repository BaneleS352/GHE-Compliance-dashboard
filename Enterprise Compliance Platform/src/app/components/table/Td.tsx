import { type ReactNode } from "react";

interface TdProps {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}

export function Td({ children, className = "", colSpan }: TdProps) {
  return (
    <td colSpan={colSpan} className={`whitespace-nowrap px-5 py-3 ${className}`.trim()}>
      {children}
    </td>
  );
}
