import React from "react";

/** Form field label with optional required marker, hint, and error. */
export function FL({
  children,
  required,
  hint,
  error,
}: {
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="mb-2">
      <p className="text-sm font-semibold text-foreground">
        {children}
        {required && <span className="text-red-400 ml-1 font-bold">*</span>}
      </p>
      {hint && (
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-500 mt-0.5 font-medium">{error}</p>
      )}
    </div>
  );
}
