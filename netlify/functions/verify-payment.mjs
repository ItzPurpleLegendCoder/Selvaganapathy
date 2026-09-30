// Confirms a Razorpay payment is genuine (Razorpay Standard Checkout, step 3).
// Razorpay signs order_id|payment_id with our key secret; we recompute it and compare.
import { createHmac, timingSafeEqual } from "node:crypto";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return json({ error: "not-configured" }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ verified: false, error: "Missing payment details." }, 400); }
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body || {};
  if (![orderId, paymentId, signature].every((v) => typeof v === "string" && v)) {
    return json({ verified: false, error: "Missing payment details." }, 400);
  }

  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return json({ verified: false, error: "The payment could not be verified." }, 400);
  }
  return json({ verified: true, payment_id: paymentId });
};

export const config = { path: "/api/verify-payment" };
