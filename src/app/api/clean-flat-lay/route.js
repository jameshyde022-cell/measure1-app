import { NextResponse } from 'next/server';
import { consumeShopifyGeneration, normalizeShop } from '../../../lib/shopify';

export const maxDuration = 60;

const FLAT_LAY_PROMPT = `Use the uploaded garment image as the exact product reference.

Create a clean ecommerce flat-lay product image.

Main task:
- remove the background
- remove hangers, hooks, clips, props, stands, tags hanging outside the garment, and visual clutter
- keep the garment centered on a plain light studio background

Preserve the original item:
- preserve the original flat or hanging silhouette from the source photo
- preserve the original proportions, shoulder width, sleeve angle, hem shape, garment openness, wrinkles, drape, fabric texture, color, print, pattern placement, labels, buttons, zippers, seams, pockets, lining, trim, and construction
- do not redesign, restyle, beautify, simplify, replace, or invent garment details
- if part of the garment is unclear, stay conservative and keep it close to the uploaded image

Do not create a ghost mannequin:
- do not add mannequin volume
- do not add body shape, chest shape, bust shape, waist shaping, hips, arms, legs, neck, hands, feet, shoes, skin, face, or human form
- do not make the garment look worn by a person
- do not make the garment tighter, slimmer, more filled-out, or more form-fitting than the source

Final result:
- the output should look like the same physical garment cleaned up for a store listing
- it should be suitable for adding measurement lines afterward`;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image_file');
    const shop = normalizeShop(formData.get('shop'));

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (shop) {
      const status = await consumeShopifyGeneration(shop);
      if (!status.allowed) {
        return NextResponse.json({
          error: status.plan === 'none'
            ? 'Subscribe to Measure Pro to generate images.'
            : `Monthly limit reached (${status.limit}/month). Upgrade or wait for next billing period.`,
          billingStatus: status,
        }, { status: 402 });
      }
    } else {
      return NextResponse.json({ error: 'Missing or invalid shop.' }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';
    const models = [
      'gemini-3.1-flash-image',
      'gemini-2.5-flash-image',
    ];

    let lastError = null;

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Image,
                    },
                  },
                  { text: FLAT_LAY_PROMPT },
                ],
              }],
              generationConfig: {
                responseModalities: ['TEXT', 'IMAGE'],
                imageConfig: { imageSize: '1K' },
              },
            }),
          }
        );

        const rawText = await response.text();

        if (!response.ok) {
          lastError = rawText.slice(0, 500);
          continue;
        }

        let data;
        try {
          data = JSON.parse(rawText);
        } catch (error) {
          lastError = `JSON parse failed: ${error.message}`;
          continue;
        }

        const parts = data?.candidates?.[0]?.content?.parts;
        const imagePart = parts?.find((part) =>
          part.inline_data?.mime_type?.startsWith('image/') ||
          part.inlineData?.mimeType?.startsWith('image/')
        );

        if (!imagePart) {
          lastError = 'No image returned';
          continue;
        }

        const blob = imagePart.inline_data || imagePart.inlineData;
        const contentType = blob.mime_type || blob.mimeType;
        const imageBuffer = Buffer.from(blob.data, 'base64');

        return new NextResponse(imageBuffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Length': imageBuffer.length.toString(),
          },
        });
      } catch (error) {
        lastError = error.message;
      }
    }

    return NextResponse.json({ error: lastError || 'All models failed' }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
