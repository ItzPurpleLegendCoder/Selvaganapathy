// Creates a Razorpay order for a donation (Razorpay Standard Checkout, step 1).
// The keys live only in Netlify: Site configuration > Environment variables >
// RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET. They are never written in this code.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const id = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) return json({ error: "not-configured" }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Please enter an amount." }, 400); }
  const paise = Math.round(Number(body?.amount) * 100);
  if (!Number.isFinite(paise) || paise < 100) return json({ error: "The smallest donation is ₹1." }, 400);
  if (paise > 50000000) return json({ error: "For donations above ₹5,00,000 please contact the Trust." }, 400);

  let res;
  try {
    res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      },
      body: JSON.stringify({ amount: paise, currency: "INR", receipt: `donation_${Date.now()}`, notes: { purpose: "Donation" } }),
    });
  } catch {
    return json({ error: "Could not reach Razorpay. Please try again." }, 500);
  }
  if (res.status === 401) return json({ error: "Payment setup error. Please contact the Trust." }, 401);
  const order = await res.json().catch(() => ({}));
  if (!res.ok || !order.id) return json({ error: "Could not start the payment. Please try again." }, 500);

  // The key id is public by design (Razorpay's checkout needs it); the secret never leaves this function.
  return json({ order_id: order.id, amount: order.amount, currency: order.currency, key_id: id });
};

export const config = { path: "/api/create-order" };
