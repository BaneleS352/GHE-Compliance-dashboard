import { Thead, Th } from "./table";

export function THead({ cols, compact }: { cols: string[]; compact?: boolean }) {
  return (
    <Thead>
      {cols.map((c) => (
        <Th key={c} className={compact ? "px-2 py-2.5" : ""}>{c}</Th>
      ))}
    </Thead>
  );
}
