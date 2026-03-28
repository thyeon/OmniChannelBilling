let counter = 0;

/**
 * Generates a unique temporary DocNo in ddmmyyhhmm + 2-digit sequence format.
 * e.g., 280326143005 = 28 Mar 2026, 14:30, sequence 05.
 * Sequence wraps every 100 invoices per minute — acceptable for troubleshooting use case.
 */
export function generateTempDocNo(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const seq = String(counter++ % 100).padStart(2, '0');
  return `${dd}${mm}${yy}${hh}${min}${seq}`;
}
