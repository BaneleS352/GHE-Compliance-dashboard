export function THead({ cols, compact }: { cols: string[]; compact?: boolean }) {
  return (
    <thead>
      <tr className="border-b border-border bg-[#F7F8FC]">
        {cols.map((c) => (
          <th
            key={c}
            className={`text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider ${compact ? "px-2 py-2.5" : "px-5 py-3"}`}
          >
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}
