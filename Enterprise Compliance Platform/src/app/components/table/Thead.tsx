import { type ReactNode } from "react";

interface TheadProps {
  children: ReactNode;
  className?: string;
}

export function Thead({ children, className = "" }: TheadProps) {
  return (
    <thead className={className}>
      <tr className="border-b border-border bg-table-header-bg">{children}</tr>
    </thead>
  );
}
