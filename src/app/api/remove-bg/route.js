// /src/app/api/remove-bg/route.js
// Server-side proxy for the PhotoRoom background removal API.
// Keeps the API key on the server and avoids browser-side CORS issues.
// Requires a logged-in user and enforces the free-plan daily limit.

import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  try {
    if (!process.env.PHOTOROOM_API_KEY) {
      return Response.json(
        { error: "Missing PHOTOROOM_API_KEY in server environment." },
        { status: 500 }
      );
    }

    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return Response.json(
        { error: "Log in to use background removal." },
        { status: 401 }
      );
    }

    // Client scoped to the caller's session so auth.uid() works in the RPC.
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { error: "Log in to use background removal." },
        { status: 401 }
      );
    }

    const { data: usage, error: usageError } = await supabaseUser.rpc(
      "consume_bg_removal"
    );

    if (usageError) {
      return Response.json({ error: usageError.message }, { status: 500 });
    }

    if (!usage?.allowed) {
      return Response.json(
        {
          error:
            "Free plan includes 1 background removal per day. Upgrade to Pro for unlimited.",
        },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const imageFile = formData.get("image_file");

    if (!imageFile) {
      return Response.json({ error: "No image provided." }, { status: 400 });
    }

    const photoRoomForm = new FormData();
    photoRoomForm.append("image_file", imageFile);
    photoRoomForm.append("bg_color", "ffffff");
    photoRoomForm.append("format", "png");

    const response = await fetch("https://sdk.photoroom.com/v1/segment", {
      method: "POST",
      headers: {
        "x-api-key": process.env.PHOTOROOM_API_KEY,
      },
      body: photoRoomForm,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return Response.json(
        { error: errorText || `PhotoRoom request failed with HTTP ${response.status}.` },
        { status: 500 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Background removal error:", error);
    return Response.json(
      { error: error?.message || "Background removal failed." },
      { status: 500 }
    );
  }
}
