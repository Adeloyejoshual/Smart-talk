// src/payments.js
import { loadStripe } from "@stripe/stripe-js";
import FlutterwaveCheckout from "flutterwave-react-v3";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

export async function handleStripePayment(amount, uid) {
  try {
    const stripe = await stripePromise;

    const response = await fetch(
      `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/api/createStripeSession`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, uid }),
      }
    );

    const session = await response.json();
    if (session.url) {
      window.location.href = session.url;
    } else {
      alert("Error creating Stripe session");
    }
  } catch (error) {
    console.error("Stripe error:", error);
  }
}

export function handleFlutterwavePayment(amount, uid) {
  FlutterwaveCheckout({
    public_key: import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY,
    tx_ref: Date.now(),
    amount: amount,
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
        await fetch(
          `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/api/flutterwaveWebhook`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid, amount, tx_ref: response.tx_ref }),
          }
        );
        alert("Payment successful!");
      } else {
        alert("Payment failed or canceled");
      }
    },
    onclose: () => console.log("Payment closed"),
  });
}