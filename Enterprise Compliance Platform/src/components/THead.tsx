export function THead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-border bg-[#F7F8FC]">
        {cols.map((c) => (
          <th
            key={c}
            className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3"
          >
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}
