export const calculateCost = (seconds) => {
  const rate = parseFloat(process.env.CALL_RATE_PER_SECOND || "0.0033");
  return Number((seconds * rate).toFixed(4));
};