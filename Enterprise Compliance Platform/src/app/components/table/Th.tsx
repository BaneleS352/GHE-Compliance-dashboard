import { type ReactNode } from "react";

interface ThProps {
  children: ReactNode;
  sortable?: boolean;
  active?: boolean;
  direction?: "asc" | "desc";
  onClick?: () => void;
  className?: string;
}

export function Th({ children, sortable, active, direction, onClick, className = "" }: ThProps) {
  const base = "px-5 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider";
  const sortClasses = sortable
    ? "cursor-pointer transition-all duration-200 hover:bg-purple-50/45 hover:text-purple-700"
    : "";
  return (
    <th onClick={onClick} className={`${base} ${sortClasses} ${className}`.trim()}>
      {children}
      {active ? (direction === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}
