export const getCallRate = () => {
  return parseFloat(import.meta.env.VITE_CALL_RATE_PER_SECOND || 0.0033);
};

export const calculateCost = (durationInSeconds) => {
  const rate = getCallRate();
  return parseFloat((durationInSeconds * rate).toFixed(4));
};