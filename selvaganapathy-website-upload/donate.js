// Donate Now: opens Razorpay's payment window on this page (Standard Checkout).
// If online checkout is not set up yet, the button falls back to the Razorpay Payment Page link.
(function () {
  var form = document.getElementById("donate-form");
  var input = document.getElementById("donate-amount");
  var button = document.getElementById("donate-button");
  var msg = document.getElementById("donate-message");
  var fallback = form.getAttribute("data-fallback");

  function say(text, ok) {
    msg.textContent = text;
    msg.className = "donate-message" + (ok ? " ok" : text ? " err" : "");
  }
  function busy(on) { button.disabled = on; button.textContent = on ? "Please wait…" : "Donate Now"; }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    say("");
    var amount = Number(input.value);
    if (!(amount >= 1)) { say("Please enter an amount of ₹1 or more."); input.focus(); return; }
    busy(true);
    try {
      var res = await fetch("/api/create-order", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: amount }),
      });
      var data = await res.json().catch(function () { return {}; });
      // Checkout not switched on (no keys in Netlify, or the functions are missing): use the Payment Page.
      var notReady = data.error === "not-configured" || (!data.order_id && !data.error) || typeof Razorpay === "undefined";
      if (notReady) {
        if (fallback) { window.location.href = fallback; return; }
      }
      if (!res.ok) { say(data.error || "Could not start the payment. Please try again."); busy(false); return; }

      var rzp = new Razorpay({
        key: data.key_id,
        order_id: data.order_id,
        amount: data.amount,
        currency: data.currency,
        name: "Selvaganapathy Charitable Trust",
        description: "Donation",
        image: "https://selvaganapathy.org/apple-touch-icon.png",
        theme: { color: "#b8336a" },
        handler: async function (payment) {
          say("Confirming your donation…", true);
          try {
            var v = await fetch("/api/verify-payment", {
              method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payment),
            });
            var result = await v.json().catch(function () { return {}; });
            if (v.ok && result.verified) {
              say("Thank you. Your donation was received. Payment ID: " + result.payment_id, true);
              input.value = "";
            } else {
              say("We could not confirm this payment. If money was taken, please contact the Trust with Payment ID " + payment.razorpay_payment_id + ".");
            }
          } catch (err) {
            say("We could not confirm this payment. If money was taken, please contact the Trust with Payment ID " + payment.razorpay_payment_id + ".");
          }
          busy(false);
        },
        modal: { ondismiss: function () { say("Payment cancelled. Nothing was charged."); busy(false); } },
      });
      rzp.on("payment.failed", function (r) {
        say("The payment did not go through: " + ((r.error && r.error.description) || "please try again") + ".");
        busy(false);
      });
      rzp.open();
    } catch (err) {
      if (fallback) { window.location.href = fallback; return; }
      say("Could not start the payment. Please check your connection and try again.");
      busy(false);
    }
  });
})();
