/** Minimal CSV parser (quotes, doubled quotes, CRLF) for the Tokyo open data files. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') ((cell += '"'), i++);
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') (row.push(cell), (cell = ''));
    else if (c === '\n')
      (row.push(cell.replace(/\r$/, '')),
        rows.push(row),
        (row = []),
        (cell = ''));
    else cell += c;
  }
  if (cell || row.length) (row.push(cell), rows.push(row));
  return rows;
}
