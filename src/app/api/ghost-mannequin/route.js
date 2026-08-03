import { NextResponse } from 'next/server';
import { consumeShopifyGeneration, verifySessionToken } from '../../../lib/shopify';

export const maxDuration = 60;

const TOP_FEMALE_FRONT_PROMPT = `Use the uploaded garment as the exact reference and render it as a front-facing photorealistic ghost-mannequin ecommerce image on a pure white background. Use a realistic feminine invisible body form appropriate for the garment. Show natural three-dimensional structure with supported shoulders, bust, chest, torso, waist shaping, sleeve volume where applicable, realistic drape, depth, and side-seam curvature. Preserve the exact top exactly as shown, including silhouette, fabric, texture, color, print, trim, seams, stitching, closures, proportions, and all design details. Produce a clean high-resolution ecommerce result with only the garment visible, centered, fully presented, and shown straight-on from the front.`;

const TOP_FEMALE_REAR_PROMPT = `Use the uploaded garment as the exact reference and render it as a back-facing photorealistic ghost-mannequin ecommerce image on a pure white background. Use a realistic feminine invisible body form appropriate for the garment. Show natural three-dimensional structure with supported shoulders, upper back, waist shaping, sleeve volume where applicable, realistic drape, depth, and side-seam curvature. Preserve the exact top exactly as shown, including silhouette, fabric, texture, color, print, trim, seams, stitching, closures, proportions, and all back design details. Produce a clean high-resolution ecommerce result with only the garment visible, centered, fully presented, and shown straight-on from the back.`;

const TOP_MALE_FRONT_PROMPT = `Use the uploaded garment as the exact reference and render it as a front-facing photorealistic ghost-mannequin ecommerce image on a pure white background. Use a realistic masculine invisible body form appropriate for the garment. Show natural three-dimensional structure with supported shoulders, chest, torso, waist shaping, sleeve volume where applicable, realistic drape, depth, and side-seam curvature. Preserve the exact top exactly as shown, including silhouette, fabric, texture, color, print, trim, seams, stitching, closures, proportions, and all design details. Produce a clean high-resolution ecommerce result with only the garment visible, centered, fully presented, and shown straight-on from the front.`;

const TOP_MALE_REAR_PROMPT = `Use the uploaded garment as the exact reference and render it as a back-facing photorealistic ghost-mannequin ecommerce image on a pure white background. Use a realistic masculine invisible body form appropriate for the garment. Show natural three-dimensional structure with supported shoulders, upper back, torso shaping, sleeve volume where applicable, realistic drape, depth, and side-seam curvature. Preserve the exact top exactly as shown, including silhouette, fabric, texture, color, print, trim, seams, stitching, closures, proportions, and all back design details. Produce a clean high-resolution ecommerce result with only the garment visible, centered, fully presented, and shown straight-on from the back.`;

const PANTS_FEMALE_FRONT_PROMPT = `Use the uploaded garment as the exact reference and render it as a front-facing photorealistic ghost-mannequin ecommerce image on a pure white background. Use a realistic feminine invisible body form appropriate for the garment. Show natural three-dimensional structure with supported waist, hips, seat transition, front rise, thigh shaping, leg volume, realistic drape, depth, and side-seam curvature. Preserve the exact pants exactly as shown, including silhouette, fabric, texture, color, print, waistband, pockets, fly, seams, stitching, trim, proportions, and all design details. Produce a clean high-resolution ecommerce result with only the garment visible, centered, fully presented, and shown straight-on from the front.`;

const PANTS_FEMALE_REAR_PROMPT = `Use the uploaded garment as the exact reference and render it as a back-facing photorealistic ghost-mannequin ecommerce image on a pure white background. Use a realistic feminine invisible body form appropriate for the garment. Show natural three-dimensional structure with supported waist, hips, seat, upper leg shaping, leg volume, realistic drape, depth, and side-seam curvature. Preserve the exact pants exactly as shown, including silhouette, fabric, texture, color, print, waistband, back pockets where applicable, seams, stitching, trim, proportions, and all back design details. Produce a clean high-resolution ecommerce result with only the garment visible, centered, fully presented, and shown straight-on from the back.`;

const PANTS_MALE_FRONT_PROMPT = `Use the uploaded garment as the exact reference and render it as a front-facing photorealistic ghost-mannequin ecommerce image on a pure white background. Use a realistic masculine invisible body form appropriate for the garment. Show natural three-dimensional structure with supported waist, hips, front rise, thigh shaping, leg volume, realistic drape, depth, and side-seam curvature. Preserve the exact pants exactly as shown, including silhouette, fabric, texture, color, print, waistband, pockets, fly, seams, stitching, trim, proportions, and all design details. Produce a clean high-resolution ecommerce result with only the garment visible, centered, fully presented, and shown straight-on from the front.`;

const PANTS_MALE_REAR_PROMPT = `Use the uploaded garment as the exact reference and render it as a back-facing photorealistic ghost-mannequin ecommerce image on a pure white background. Use a realistic masculine invisible body form appropriate for the garment. Show natural three-dimensional structure with supported waist, seat, upper leg shaping, leg volume, realistic drape, depth, and side-seam curvature. Preserve the exact pants exactly as shown, including silhouette, fabric, texture, color, print, waistband, back pockets where applicable, seams, stitching, trim, proportions, and all back design details. Produce a clean high-resolution ecommerce result with only the garment visible, centered, fully presented, and shown straight-on from the back.`;

const SKIRT_FRONT_PROMPT = `Use the uploaded garment as the exact reference and render it as a front-facing photorealistic ghost-mannequin ecommerce image on a pure white background. Use an appropriate invisible body form for the garment. Show natural three-dimensional structure with supported waist, hips, lower-body shaping, realistic drape, depth, hem flow, and side-seam curvature. Preserve the exact skirt exactly as shown, including silhouette, fabric, texture, color, print, waistband, pleats, panels, trim, seams, stitching, proportions, and all design details. Produce a clean high-resolution ecommerce result with only the garment visible, centered, fully presented, and shown straight-on from the front.`;

const SKIRT_REAR_PROMPT = `Use the uploaded garment as the exact reference and render it as a back-facing photorealistic ghost-mannequin ecommerce image on a pure white background. Use an appropriate invisible body form for the garment. Show natural three-dimensional structure with supported waist, hips, seat shaping where applicable, realistic drape, depth, hem flow, and side-seam curvature. Preserve the exact skirt exactly as shown, including silhouette, fabric, texture, color, print, waistband, pleats, panels, trim, seams, stitching, proportions, and all back design details. Produce a clean high-resolution ecommerce result with only the garment visible, centered, fully presented, and shown straight-on from the back.`;

const DRESS_FRONT_PROMPT = `Use the uploaded garment as the exact reference and render it as a front-facing photorealistic ghost-mannequin ecommerce image on a pure white background. Use a realistic feminine invisible body form appropriate for the garment. Show natural three-dimensional structure with supported shoulders, bust, chest, waist, hips, skirt volume where applicable, sleeve volume where applicable, realistic drape, depth, hem flow, and side-seam curvature. Preserve the exact dress exactly as shown, including silhouette, fabric, texture, color, print, neckline, trim, seams, stitching, closures, proportions, and all design details. Produce a clean high-resolution ecommerce result with only the garment visible, centered, fully presented, and shown straight-on from the front.`;

const DRESS_REAR_PROMPT = `Use the uploaded garment as the exact reference and render it as a back-facing photorealistic ghost-mannequin ecommerce image on a pure white background. Use a realistic feminine invisible body form appropriate for the garment. Show natural three-dimensional structure with supported shoulders, upper back, waist, hips, skirt volume where applicable, sleeve volume where applicable, realistic drape, depth, hem flow, and side-seam curvature. Preserve the exact dress exactly as shown, including silhouette, fabric, texture, color, print, back neckline, trim, seams, stitching, closures, proportions, and all back design details. Produce a clean high-resolution ecommerce result with only the garment visible, centered, fully presented, and shown straight-on from the back.`;

const JACKET_FEMALE_FRONT_PROMPT = `Use the uploaded garment as the exact reference and render it as a front-facing photorealistic ghost-mannequin ecommerce image on a pure white background. Use a realistic feminine invisible body form appropriate for the garment. Show natural three-dimensional structure with supported shoulders, bust, chest, torso, waist shaping, sleeve volume, collar and lapel structure where applicable, realistic drape, depth, and side-seam curvature. Preserve the exact jacket exactly as shown, including silhouette, fabric, texture, color, print, lining visibility where applicable, collar, lapels, closures, pockets, seams, stitching, trim, proportions, and all design details. Produce a clean high-resolution ecommerce result with only the garment visible, centered, fully presented, and shown straight-on from the front.`;

const JACKET_FEMALE_REAR_PROMPT = `Use the uploaded garment as the exact reference and render it as a back-facing photorealistic ghost-mannequin ecommerce image on a pure white background. Use a realistic feminine invisible body form appropriate for the garment. Show natural three-dimensional structure with supported shoulders, upper back, waist shaping, sleeve volume, hem structure, realistic drape, depth, and side-seam curvature. Preserve the exact jacket exactly as shown, including silhouette, fabric, texture, color, print, collar shape, seams, stitching, trim, proportions, and all back design details. Produce a clean high-resolution ecommerce result with only the garment visible, centered, fully presented, and shown straight-on from the back.`;

const JACKET_MALE_FRONT_PROMPT = `Use the uploaded garment as the exact reference and render it as a front-facing photorealistic ghost-mannequin ecommerce image on a pure white background. Use a realistic masculine invisible body form appropriate for the garment. Show natural three-dimensional structure with supported shoulders, chest, torso, waist shaping, sleeve volume, collar and lapel structure where applicable, realistic drape, depth, and side-seam curvature. Preserve the exact jacket exactly as shown, including silhouette, fabric, texture, color, print, lining visibility where applicable, collar, lapels, closures, pockets, seams, stitching, trim, proportions, and all design details. Produce a clean high-resolution ecommerce result with only the garment visible, centered, fully presented, and shown straight-on from the front.`;

const JACKET_MALE_REAR_PROMPT = `Use the uploaded garment as the exact reference and render it as a back-facing photorealistic ghost-mannequin ecommerce image on a pure white background. Use a realistic masculine invisible body form appropriate for the garment. Show natural three-dimensional structure with supported shoulders, upper back, torso shaping, sleeve volume, hem structure, realistic drape, depth, and side-seam curvature. Preserve the exact jacket exactly as shown, including silhouette, fabric, texture, color, print, collar shape, seams, stitching, trim, proportions, and all back design details. Produce a clean high-resolution ecommerce result with only the garment visible, centered, fully presented, and shown straight-on from the back.`;

export async function POST(req) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image_file');
    const gender = formData.get('gender') || 'female';
    const view = formData.get('view') || 'front';
    const garmentType = formData.get('garmentType') || 'top';
    const shop = verifySessionToken(req.headers.get('authorization'));

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

    console.log('[ghost-mannequin] request received', {
      receivedBytes: imageFile.size, mimeType: imageFile.type, gender, view, garmentType,
    });

    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const isRear = view === 'rear';
    let prompt;
    switch (garmentType) {
      case 'pants':
        prompt = gender === 'male'
          ? (isRear ? PANTS_MALE_REAR_PROMPT : PANTS_MALE_FRONT_PROMPT)
          : (isRear ? PANTS_FEMALE_REAR_PROMPT : PANTS_FEMALE_FRONT_PROMPT);
        break;
      case 'skirt':
        prompt = isRear ? SKIRT_REAR_PROMPT : SKIRT_FRONT_PROMPT;
        break;
      case 'dress':
        prompt = isRear ? DRESS_REAR_PROMPT : DRESS_FRONT_PROMPT;
        break;
      case 'jacket':
        prompt = gender === 'male'
          ? (isRear ? JACKET_MALE_REAR_PROMPT : JACKET_MALE_FRONT_PROMPT)
          : (isRear ? JACKET_FEMALE_REAR_PROMPT : JACKET_FEMALE_FRONT_PROMPT);
        break;
      case 'top':
      default:
        prompt = gender === 'male'
          ? (isRear ? TOP_MALE_REAR_PROMPT : TOP_MALE_FRONT_PROMPT)
          : (isRear ? TOP_FEMALE_REAR_PROMPT : TOP_FEMALE_FRONT_PROMPT);
        break;
    }

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
                    }
                  },
                  {
                    text: prompt
                  }
                ]
              }],
              generationConfig: {
                responseModalities: ['TEXT', 'IMAGE'],
                imageConfig: { imageSize: '1K' },
              }
            })
          }
        );

        const rawText = await response.text();
        console.log(`[ghost-mannequin] model=${model} status=${response.status} raw_response_length=${rawText.length}`)
        console.log(`[ghost-mannequin] raw_response=${rawText.slice(0, 2000)}`)

        if (!response.ok) {
          lastError = rawText.slice(0, 500);
          console.error(`[ghost-mannequin] model=${model} NOT OK:`, lastError);
          continue;
        }

        let data
        try { data = JSON.parse(rawText) } catch (e) {
          lastError = 'JSON parse failed: ' + e.message
          console.error(`[ghost-mannequin] JSON parse error:`, e.message, 'raw:', rawText.slice(0, 500))
          continue
        }

        console.log(`[ghost-mannequin] candidates count:`, data?.candidates?.length)
        const parts = data?.candidates?.[0]?.content?.parts;
        console.log(`[ghost-mannequin] parts count:`, parts?.length, 'part keys:', parts?.map(p => Object.keys(p).join(',')).join(' | '))

        const imagePart = parts?.find(p =>
          p.inline_data?.mime_type?.startsWith('image/') ||
          p.inlineData?.mimeType?.startsWith('image/')
        );

        if (!imagePart) {
          lastError = 'No image returned';
          console.error(`[ghost-mannequin] model=${model} no image part. Full parts:`, JSON.stringify(parts));
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
    console.error('Ghost mannequin error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
