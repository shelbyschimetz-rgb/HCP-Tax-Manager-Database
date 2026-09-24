/* Client-side filter / sort / group for list views (pure — unit tested). */

export function applyListOps(rows, { filters, sort, group }, columns) {
  let out = rows.slice();
  const colBy = Object.fromEntries(columns.map((c) => [c.key, c]));
  const text = (r, key) => {
    const c = colBy[key];
    const v = c && c.text ? c.text(r) : r[key];
    return v == null ? '' : String(v);
  };
  (filters || []).forEach((f) => {
    if (!f.col) return;
    out = out.filter((r) => {
      const v = text(r, f.col).toLowerCase();
      const want = String(f.val || '').toLowerCase();
      if (f.op === 'contains') return v.includes(want);
      if (f.op === 'equals') return v === want;
      if (f.op === 'not') return v !== want;
      if (f.op === 'empty') return !v || v === 'false';
      if (f.op === 'not_empty') return !!v && v !== 'false';
      return true;
    });
  });
  if (sort && sort.col) {
    const c = colBy[sort.col];
    const val = (r) => { const v = c && c.sortVal ? c.sortVal(r) : r[sort.col]; return v == null ? '' : v; };
    out.sort((a, b) => {
      const A = val(a), B = val(b);
      if (A === B) return 0;
      if (A === '') return 1;
      if (B === '') return -1;
      const cmp = typeof A === 'number' && typeof B === 'number' ? A - B : String(A).localeCompare(String(B), undefined, { numeric: true, sensitivity: 'base' });
      return sort.dir === 'desc' ? -cmp : cmp;
    });
  }
  if (group) {
    const map = new Map();
    out.forEach((r) => {
      const raw = r[group];
      const k = raw == null || raw === '' ? '(empty)' : String(raw);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    const order = colBy[group] && colBy[group].groupOrder;
    let groups = [...map.entries()].map(([key, rs]) => ({ key, rows: rs }));
    if (order) groups.sort((a, b) => (order.indexOf(a.key) + 1 || 999) - (order.indexOf(b.key) + 1 || 999));
    return { grouped: true, groups, count: out.length, flat: groups.flatMap((g) => g.rows) };
  }
  return { grouped: false, rows: out, count: out.length, flat: out };
}
