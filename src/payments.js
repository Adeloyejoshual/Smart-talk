import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
const API_BASE = import.meta.env.VITE_API_URL || "https://smart-talk-51dl.onrender.com";

// 🚀 STRIPE PAYMENT HANDLER
export async function handleStripePayment(amount, uid) {
  try {
    const stripe = await stripePromise;

    const response = await fetch(`${API_BASE}/api/createStripeSession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, uid }),
    });

    const session = await response.json();
    if (session.url) {
      window.location.href = session.url;
    } else {
      alert("Error creating Stripe session");
    }
  } catch (error) {
    console.error("Stripe error:", error);
    alert("Stripe payment failed. Try again later.");
  }
}

// 🚀 FLUTTERWAVE PAYMENT HANDLER (CDN-based)
export function handleFlutterwavePayment(amount, uid) {
  const script = document.createElement("script");
  script.src = "https://checkout.flutterwave.com/v3.js";
  script.onload = () => {
    window.FlutterwaveCheckout({
      public_key: import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY,
      tx_ref: Date.now(),
      amount,
      currency: "USD",
      payment_options: "card, paypal, ussd",
      customer: {
        email: `${uid}@appuser.com`,
        name: "App User",
      },
      customizations: {
        title: "Wallet Top-up",
        description: "Add funds to your wallet",
        logo: "https://yourapp.com/logo.png",
      },
      callback: async (response) => {
        if (response.status === "successful") {
          await fetch(`${API_BASE}/api/flutterwaveWebhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid,
              amount,
              tx_ref: response.tx_ref,
            }),
          });
          alert("✅ Payment successful!");
        } else {
          alert("❌ Payment failed or canceled");
        }
      },
      onclose: () => console.log("Flutterwave modal closed"),
    });
  };
  document.body.appendChild(script);
}