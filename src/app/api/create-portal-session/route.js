import { stripe } from "../../../lib/stripe";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function POST(request) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return Response.json({ error: "Not logged in" }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return Response.json({ error: "Not logged in" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return Response.json({ error: profileError.message }, { status: 500 });
    }

    if (!profile?.stripe_customer_id) {
      return Response.json(
        { error: "No billing account found for this user." },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!siteUrl) {
      return Response.json(
        { error: "Missing NEXT_PUBLIC_SITE_URL" },
        { status: 500 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: siteUrl,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to create portal session" },
      { status: 500 }
    );
  }
}
