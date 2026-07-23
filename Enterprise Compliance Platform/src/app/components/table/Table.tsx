import { type ReactNode } from "react";

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = "" }: TableProps) {
  return <table className={`w-full text-sm ${className}`.trim()}>{children}</table>;
}
