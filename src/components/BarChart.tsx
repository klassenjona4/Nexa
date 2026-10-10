// Port of the design system's BarChart (compact size): direct labels, 1pt Ink baseline,
// Stone bars, one Rust highlight, tabular numerals.
export function BarChart({ data, highlight, max, unit = '', categoryLabel, valueLabel }: { data: { label: string; value: number }[]; highlight?: number; max?: number; unit?: string; categoryLabel?: string; valueLabel?: string }) {
  const top = max && max > 0 ? max : Math.max(...data.map((d) => d.value), 1) / 0.88;
  const grid = { display: 'grid', gridTemplateColumns: '56px minmax(0,1fr)', gap: 8, alignItems: 'center' } as const;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--font-sans)', fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
      {categoryLabel || valueLabel ? (
        <div style={{ ...grid, paddingBottom: '10pt', borderBottom: '0.5pt solid var(--sage)', fontSize: 12, color: 'var(--graphite)' }}>
          <span>{categoryLabel}</span>
          <span>{valueLabel}</span>
        </div>
      ) : null}
      {data.map((d, i) => {
        const hi = i === highlight;
        return (
          <div key={i} style={grid}>
            <span style={{ fontWeight: hi ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderLeft: '1pt solid var(--ink)' }}>
              <div style={{ height: 20, width: `${Math.min(100, (d.value / top) * 100)}%`, background: hi ? 'var(--rust)' : 'var(--stone)' }} />
              <span style={{ fontWeight: hi ? 600 : 400, color: hi ? 'var(--rust)' : 'var(--ink)' }}>
                {d.value}
                {unit}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
