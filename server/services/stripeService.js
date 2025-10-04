import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

export async function createStripeCheckout(amountUSD, uid, origin) {
  // amountUSD: decimal number in USD
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: 'SmartTalk Credit' },
        unit_amount: Math.round(amountUSD * 100)
      },
      quantity: 1
    }],
    mode: 'payment',
    success_url: `${origin}/wallet?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/wallet`,
    metadata: { uid }
  });
  return session;
}
