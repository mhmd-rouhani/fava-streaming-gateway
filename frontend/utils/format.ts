export function displayName(key: string): string {
  const parts = key.split('-');
  if (parts.length >= 3) return parts.slice(2).join('-');
  return key;
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return '—';
  const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت'] as const;
  let v = Number(n);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const value = v.toFixed(i === 0 ? 0 : 1);
  return `${toPersianDigits(value)} ${units[i]}`;
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString('fa-IR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(d);
  }
}

function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]!);
}
