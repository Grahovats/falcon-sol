export const usdc = (value: string) => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(Number(value))} USDC`
