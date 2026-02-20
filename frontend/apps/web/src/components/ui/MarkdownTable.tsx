/**
 * Renders a markdown-formatted table string as a styled HTML <table>.
 *
 * Expects standard GFM table syntax:
 *   | Header 1 | Header 2 |
 *   | --- | --- |
 *   | Cell 1 | Cell 2 |
 */

interface MarkdownTableProps {
  /** Raw markdown table string (header + separator + data rows) */
  markdown: string;
}

function parseRow(row: string): string[] {
  // Split on | but ignore leading/trailing pipe
  return row
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

export function MarkdownTable({ markdown }: MarkdownTableProps) {
  const lines = markdown.trim().split('\n');
  if (lines.length < 2) return <span>{markdown}</span>;

  const headerCells = parseRow(lines[0]);

  // lines[1] is the separator row (| --- | --- |), skip it
  const dataRows = lines.slice(2).map(parseRow);

  return (
    <div className="my-3 overflow-x-auto">
      <table className="min-w-full text-xs border-collapse border border-[var(--color-neutral-200)]">
        <thead>
          <tr className="bg-[var(--color-neutral-100)]">
            {headerCells.map((cell, i) => (
              <th
                key={i}
                className="px-2 py-1.5 text-left font-semibold border border-[var(--color-neutral-200)] text-[var(--color-text)]"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((cells, rowIdx) => (
            <tr
              key={rowIdx}
              className={rowIdx % 2 === 0 ? 'bg-[var(--color-surface)]' : 'bg-[var(--color-neutral-50)]'}
            >
              {headerCells.map((_, colIdx) => (
                <td
                  key={colIdx}
                  className="px-2 py-1 border border-[var(--color-neutral-200)] text-[var(--color-text)]"
                >
                  {cells[colIdx] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
