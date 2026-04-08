// /src/app/api/remove-bg/route.js
// Server-side proxy for the PhotoRoom background removal API.
// Keeps the API key on the server and avoids browser-side CORS issues.

export async function POST(request) {
  try {
    if (!process.env.PHOTOROOM_API_KEY) {
      return Response.json(
        { error: "Missing PHOTOROOM_API_KEY in server environment." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const imageFile = formData.get("image_file");

    if (!imageFile) {
      return Response.json({ error: "No image provided." }, { status: 400 });
    }

    const photoRoomForm = new FormData();
    photoRoomForm.append("image_file", imageFile);

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