import axios from "axios";

const FLW_BASE = "https://api.flutterwave.com/v3";

export async function initializeFlutterwave(amount, currency, redirectUrl, customer) {
  const res = await axios.post(`${FLW_BASE}/payments`, {
    tx_ref: `smarttalk_${Date.now()}`,
    amount: amount.toString(),
    currency,
    redirect_url: redirectUrl,
    customer
  }, {
    headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` }
  });
  return res.data;
}

export async function verifyFlutterwave(transactionId) {
  const res = await axios.get(`${FLW_BASE}/transactions/${transactionId}/verify`, {
    headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` }
  });
  return res.data;
}
