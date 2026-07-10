import { FC } from "react";
import { FC as ForwardRefExoticComponent } from "react";

export interface FSProps {
  id: string;
  num: string;
  title: string;
  children: React.ReactNode;
}

export const FS: FC<FSProps> = ({ id, num, title, children }) => (
  <section id={id} className="space-y-6">
    <div className="flex items-center gap-3 mb-4">
      <span className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold text-purple-900 bg-purple-100">{num}</span>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
    </div>
    <div className="pt-2 border-l-2 border-slate-200 ml-3.5">{children}</div>
  </section>
);

export const FORM_SECTIONS = [
  { id: "sec-team", num: "1", label: "Team Member Details" },
  { id: "sec-declaration", num: "2", label: "Declaration Details" },
  { id: "sec-ghe", num: "3", label: "Gift, Hospitality or Entertainment Details" },
  { id: "sec-docs", num: "4", label: "Supporting Documents" },
  { id: "sec-undertaking", num: "5", label: "Declaration & Undertaking" },
] as const;