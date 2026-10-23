import { FC } from "react";

export interface FLProps {
  htmlFor?: string;
  errorId?: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
  error?: string;
}

export const FL: FC<FLProps> = ({ htmlFor, errorId, children, required, hint, error }) => (
  <div className="block">
    <div className="flex items-center gap-1.5 mb-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">{children}</label>
      {required && <span className="text-red-400 font-bold" aria-hidden="true">*</span>}
    </div>
    {hint && <p className="text-[11px] text-muted-foreground mb-1.5">{hint}</p>}
    {error && <p id={errorId} role="alert" className="text-[11px] text-red-500 mb-1.5">{error}</p>}
  </div>
);
