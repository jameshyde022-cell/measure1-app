import { NextResponse } from 'next/server';
import { consumeShopifyGeneration, verifySessionToken } from '../../../lib/shopify';

export const maxDuration = 60;

const GARMENT_RULES = `Use the uploaded clothing image as the exact garment reference.

The uploaded garment must be reproduced faithfully without redesigning, simplifying, or adding details. Match the reference exactly:
- same garment type and overall shape
- same fabric, texture, color, pattern, and print
- same neckline, collar, lapels, or hood
- same sleeve length and cuff construction
- same buttons, zipper, pockets, seams, stitching, and trim
- same waistband, belt loops, fly, rise, and leg shape when applicable
- same hemline, garment length, fit, and proportions
- accurate print and stripe alignment across seams and panels

The clothing must look like a real, properly sewn garment being naturally worn by the mannequin. Preserve realistic fabric thickness, structure, drape, folds, tension, and gravity. Do not make the garment look painted onto the mannequin, pasted over the body, distorted, excessively wrinkled, or artificially smooth.

Show the mannequin in a straight-on front view, centered and facing directly toward the camera. Do not rotate or angle the mannequin. Keep the full garment visible without cropping any part of it.

Styling rules:
- For a shirt, blouse, sweater, jacket, or other top, pair it with simple fitted dark blue jeans or neutral trousers. Keep the uploaded garment untucked unless the reference clearly shows it tucked.
- For pants, shorts, or a skirt, pair it with a plain fitted white top that does not cover the waistband.
- For a dress or jumpsuit, do not add any other clothing.

Use a seamless pure-white ecommerce studio background with soft, even lighting, subtle natural shadows, sharp garment detail, accurate color, and professional catalog photography quality.

Do not change the garment design. Do not add logos, text, patterns, buttons, pockets, decorations, or accessories that are not visible in the uploaded reference.`;

const FEMALE_PROMPT = `${GARMENT_RULES}

Create a photorealistic ecommerce product image showing a female retail mannequin wearing the uploaded garment.

Female mannequin requirements:
- realistic full-size female retail mannequin
- anatomically correct feminine proportions
- neutral standing pose
- arms relaxed naturally at the sides
- symmetrical shoulders and limbs
- mannequin fully supports and fills out the garment without over-tightening it
- smooth matte-white mannequin surface
- featureless face or cropped mannequin head
- no hair, makeup, jewelry, or accessories
- no visible stand, pole, clips, pins, or support equipment`;

const MALE_PROMPT = `${GARMENT_RULES}

Create a photorealistic ecommerce product image showing a male retail mannequin wearing the uploaded garment.

Male mannequin requirements:
- realistic full-size male retail mannequin
- anatomically correct masculine proportions
- broad but natural shoulders
- flat male chest only
- straight male torso and natural arms
- neutral standing pose
- arms relaxed naturally at the sides
- symmetrical shoulders and limbs
- mannequin fully supports and fills out the garment without over-tightening it
- smooth matte-white mannequin surface
- featureless face or cropped mannequin head
- no hair, facial hair, jewelry, or accessories
- no visible stand, pole, clips, pins, or support equipment
- do not create breasts, bust contour, cleavage, feminine chest anatomy, or exaggerated hips`;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image_file');
    const gender = formData.get('gender') === 'male' ? 'male' : 'female';
    const shop = verifySessionToken(request.headers.get('authorization'));

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
    const prompt = gender === 'male' ? MALE_PROMPT : FEMALE_PROMPT;
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
                  { text: prompt },
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