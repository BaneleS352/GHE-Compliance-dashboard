import { FC } from "react";

export interface FLProps {
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
  error?: string;
}

export const FL: FC<FLProps> = ({ children, required, hint, error }) => (
  <label className="block">
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-sm font-semibold text-foreground">{children}</span>
      {required && <span className="text-red-400 font-bold" aria-hidden="true">*</span>}
    </div>
    {hint && <p className="text-[11px] text-muted-foreground mb-1.5">{hint}</p>}
    {error && <p className="text-[11px] text-red-500 mb-1.5">{error}</p>}
  </label>
);