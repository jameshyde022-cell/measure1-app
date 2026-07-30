import { NextResponse } from 'next/server';

export const maxDuration = 60;

const FEMALE_MODEL_PROMPT = `Use the uploaded garment image as the exact garment blueprint.

Dress the model in the garment shown in the clothing reference image.
Treat the clothing reference image as the exact garment blueprint and reproduce it faithfully.
The garment must match the reference exactly:
- same fabric
- same color
- same pattern
- same stitching
- same seams
- same construction
- same fit

Preserve garment structure and details exactly as shown in the reference:
- accurate neckline
- accurate collar
- accurate sleeve length
- two symmetrical sleeves if the garment has sleeves
- correct cuff shape
- accurate waistband
- accurate pocket placement
- accurate hemline
- accurate print alignment

The garment must follow real garment construction and align naturally across seams and panels.

Styling rules:
- If the uploaded item is a SHIRT or TOP, the model must wear the shirt untucked and pair it with fitted black leather pants.
- If the uploaded item is PANTS, the model must wear the pants exactly as shown and pair them with a white bustier crop top that exposes the midriff.
- If the uploaded item is a DRESS, the model must wear the dress exactly as shown with no additional bottoms.
- If the uploaded item is a JACKET or COAT, pair with fitted black trousers.

Model requirements:
- Female model
- Professional fashion model appearance
- Natural confident pose
- Full body visible

Photography requirements:
- Full body fashion photograph
- Clean white studio background
- Soft even studio lighting
- Centered composition
- Professional ecommerce apparel photography
- Sharp focus
- Natural skin texture
- No props
- No background elements`;

const MALE_MODEL_PROMPT = `Use the uploaded garment image as the exact garment blueprint.

Dress the model in the garment shown in the clothing reference image.
Treat the clothing reference image as the exact garment blueprint and reproduce it faithfully.
The garment must match the reference exactly:
- same fabric
- same color
- same pattern
- same stitching
- same seams
- same construction
- same fit

Preserve garment structure and details exactly as shown in the reference:
- accurate neckline
- accurate collar
- accurate sleeve length
- two symmetrical sleeves if the garment has sleeves
- correct cuff shape
- accurate waistband
- accurate pocket placement
- accurate hemline
- accurate print alignment

The garment must follow real garment construction and align naturally across seams and panels.

Styling rules:
- If the uploaded item is a SHIRT or TOP, the model must wear the shirt untucked and pair it with fitted dark denim or black trousers.
- If the uploaded item is PANTS, the model must wear the pants exactly as shown and pair them with a plain white fitted crew neck t-shirt.
- If the uploaded item is a JACKET or COAT, pair with a plain white t-shirt and dark trousers.

Model requirements:
- Male model
- Professional fashion model appearance
- Natural confident pose
- Full body visible
- FLAT MALE CHEST — no feminine chest anatomy

Photography requirements:
- Full body fashion photograph
- Clean white studio background
- Soft even studio lighting
- Centered composition
- Professional ecommerce apparel photography
- Sharp focus
- Natural skin texture
- No props
- No background elements`;

export async function POST(req) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image_file');
    const gender = formData.get('gender') || 'female';

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const prompt = gender === 'male' ? MALE_MODEL_PROMPT : FEMALE_MODEL_PROMPT;

    const models = [
      'gemini-3.1-flash-image-preview',
      'gemini-2.5-flash-image',
    ];

    let lastError = null;

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
                    }
                  },
                  {
                    text: prompt
                  }
                ]
              }],
              generationConfig: {
                responseModalities: ['TEXT', 'IMAGE'],
              }
            })
          }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          lastError = err?.error?.message || 'Model failed';
          console.error(`Model ${model} failed:`, lastError);
          continue;
        }

        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts;
        const imagePart = parts?.find(p => p.inlineData?.mimeType?.startsWith('image/'));

        if (!imagePart) {
          lastError = 'No image returned';
          console.error(`Model ${model} returned no image. Parts:`, JSON.stringify(parts));
          continue;
        }

        const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
        return new NextResponse(imageBuffer, {
          status: 200,
          headers: {
            'Content-Type': imagePart.inlineData.mimeType,
            'Content-Length': imageBuffer.length.toString(),
          }
        });

      } catch (e) {
        lastError = e.message;
        console.error(`Model ${model} threw:`, e);
        continue;
      }
    }

    return NextResponse.json({ error: lastError || 'All models failed' }, { status: 500 });

  } catch (err) {
    console.error('Model dress-up error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
