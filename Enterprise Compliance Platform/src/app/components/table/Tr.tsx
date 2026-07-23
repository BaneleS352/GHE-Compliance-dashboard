import { type ReactNode } from "react";

interface TrProps {
  children: ReactNode;
  className?: string;
}

export function Tr({ children, className = "" }: TrProps) {
  return <tr className={`transition-colors hover:bg-muted/20 ${className}`.trim()}>{children}</tr>;
}
