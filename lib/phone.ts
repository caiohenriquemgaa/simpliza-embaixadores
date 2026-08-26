export function maskBrazilianPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  const hasExplicitCountryCode = /^\s*\+55/.test(value)
    || /^\s*55\D/.test(value)
    || (digits.startsWith("55") && digits.length > 11);

  if (hasExplicitCountryCode) digits = digits.slice(2);
  digits = digits.slice(0, 11);

  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
