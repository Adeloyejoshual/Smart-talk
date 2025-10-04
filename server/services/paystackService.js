import axios from "axios";

const PAYSTACK_BASE = "https://api.paystack.co";

export async function initializePaystackTransaction(amountNGN, email, callbackUrl) {
  // amountNGN: integer (NGN), Paystack expects kobo? Paystack expects amount in kobo (so NGN*100)
  const amountKobo = Math.round(amountNGN * 100);
  const res = await axios.post(`${PAYSTACK_BASE}/transaction/initialize`, {
    email,
    amount: amountKobo,
    callback_url: callbackUrl
  }, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
  });
  return res.data;
}

export async function verifyPaystack(reference) {
  const res = await axios.get(`${PAYSTACK_BASE}/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
  });
  return res.data;
}
