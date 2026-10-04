/** Format and parse whole Rupiah amounts without floating-point rounding. */
const IDR_GROUPER = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export function formatRupiahInput(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0) return '0';
  return IDR_GROUPER.format(amount);
}

export function rupiahDigits(input: string): string {
  return input.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

export function parseRupiahInput(input: string): number | null {
  const digits = rupiahDigits(input);
  if (!digits) return 0;
  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function caretFromDigitCount(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let digitsSeen = 0;
  for (let index = 0; index < formatted.length; index++) {
    if (/\d/.test(formatted[index])) digitsSeen++;
    if (digitsSeen === digitCount) return index + 1;
  }
  return formatted.length;
}
