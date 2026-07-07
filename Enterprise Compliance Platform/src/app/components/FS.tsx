import React from "react";
import { Card } from "./Card";
import { PURPLE } from "../../config/theme";

export const FORM_SECTIONS = [
  { id: "sec-team",        num: "1", label: "Team Member Details" },
  { id: "sec-declaration", num: "2", label: "Declaration Details" },
  { id: "sec-ghe",         num: "3", label: "Gift, Hospitality or Entertainment Details" },
  { id: "sec-docs",        num: "4", label: "Supporting Documents" },
  { id: "sec-undertaking", num: "5", label: "Declaration & Undertaking" },
];

/** Numbered, titled form section wrapper. */
export function FS({
  id,
  num,
  title,
  children,
}: {
  id: string;
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-[0_4px_10px_rgba(79,29,149,0.2)] flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
        >
          {num}
        </div>
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{title}</h3>
        <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
      </div>
      <Card className="p-6 lg:p-8">{children}</Card>
    </section>
  );
}
