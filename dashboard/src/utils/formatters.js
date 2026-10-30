export const formatCurrency = (value, locale = "pt-BR", currency = "BRL") => {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
};

export const formatPercent = (value, decimals = 2) => {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
};

export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const formatRelativeDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });
};

export const truncate = (text, max = 30) => {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
};
