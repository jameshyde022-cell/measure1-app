// /src/app/api/remove-bg/route.js
// Server-side proxy for PhotoRoom API — avoids CORS issues in the browser.
// The API key lives here on the server, never exposed to the client.

export async function POST(request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image_file');

    if (!imageFile) {
      return Response.json({ error: 'No image provided' }, { status: 400 });
    }

    const photoroomForm = new FormData();
    photoroomForm.append('image_file', imageFile);
    photoroomForm.append('bg_color', 'ffffff');
    photoroomForm.append('format', 'png');

    const response = await fetch('https://sdk.photoroom.com/v1/segment', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.PHOTOROOM_API_KEY,
      },
      body: photoroomForm,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return Response.json(
        { error: error.message || `PhotoRoom error: ${response.status}` },
        { status: response.status }
      );
    }

    const imageBuffer = await response.arrayBuffer();
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Background removal error:', error);
    return Response.json({ error: 'Background removal failed' }, { status: 500 });
  }
}
