// src/utils/billing.js

/**
 * Get the current per-second call rate.
 * You can hardcode, fetch from API, or calculate dynamically.
 */
export function getCallRate() {
  // Example: $0.0033 per second (i.e., $0.06 per minute)
  return 0.0033;
}

/**
 * Calculate total cost for a call given duration.
 * @param {number} duration - Call duration in seconds
 * @returns {number} - Cost in USD
 */
export function calculateCost(duration) {
  const rate = getCallRate();
  return Number((duration * rate).toFixed(4));
}