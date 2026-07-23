import { type ReactNode } from "react";

interface TbodyProps {
  children: ReactNode;
  className?: string;
}

export function Tbody({ children, className = "" }: TbodyProps) {
  return <tbody className={`divide-y divide-border ${className}`.trim()}>{children}</tbody>;
}
