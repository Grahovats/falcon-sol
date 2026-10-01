const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const currencyFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const preciseCurrencyFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const tokenFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 })
const percentFormatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' })

export function formatDate(value: string) { return dateFormatter.format(new Date(value)) }
export function formatVirtualBalance(value: string) { return currencyFormatter.format(Number(value)) }
export function formatCurrency(value: string | number) { return preciseCurrencyFormatter.format(Number(value)) }
export function formatToken(value: string | number) { return tokenFormatter.format(Number(value)) }
export function formatPercent(value: string | number) { return `${percentFormatter.format(Number(value))}%` }
export function formatPrice(value: string | number) {
  const price = Number(value)
  return price < 0.01 ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 10 })}` : formatCurrency(price)
}
