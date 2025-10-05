// /src/utils/currencyConverter.js
import axios from "axios";

/**
 * Converts any amount from a given currency to USD
 * @param {Number} amount
 * @param {String} fromCurrency (e.g. "NGN", "EUR", "USD")
 * @returns {Number} converted amount in USD
 */
const convertToUSD = async (amount, fromCurrency) => {
  try {
    if (fromCurrency === "USD") return amount;

    const res = await axios.get(
      `https://api.exchangerate.host/convert?from=${fromCurrency}&to=USD&amount=${amount}`
    );

    return parseFloat(res.data.result.toFixed(2));
  } catch (err) {
    console.error("Currency conversion failed:", err);
    return amount; // fallback
  }
};

export default convertToUSD;
