export const fmt = (n: number, digits = 1) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", {
        maximumFractionDigits: digits,
        minimumFractionDigits: 0,
      })
    : "—";
