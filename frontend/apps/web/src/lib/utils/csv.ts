/**
 * CSV generation utilities.
 * Handles proper quoting/escaping per RFC 4180.
 */

function escapeCsvField(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function formatCsvRow(values: string[]): string {
  return values.map(escapeCsvField).join(',');
}

export function generateCsv(headers: string[], rows: string[][]): string {
  const lines = [formatCsvRow(headers), ...rows.map(formatCsvRow)];
  return lines.join('\r\n') + '\r\n';
}
