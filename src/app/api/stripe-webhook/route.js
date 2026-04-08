import Stripe from "stripe";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    return Response.json(
      { error: `Webhook Error: ${error.message}` },
      { status: 400 }
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.userId;

      if (userId) {
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ plan: "pro" })
          .eq("id", userId);

        if (error) {
          return Response.json(
            { error: error.message || "Failed to update plan" },
            { status: 500 }
          );
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    return Response.json(
      { error: error.message || "Webhook failed" },
      { status: 500 }
    );
  }
}