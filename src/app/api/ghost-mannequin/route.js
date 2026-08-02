import { NextResponse } from 'next/server';
import { consumeShopifyGeneration, normalizeShop } from '../../../lib/shopify';

export const maxDuration = 60;

const FEMALE_PROMPT = `Use the uploaded garment image as the exact garment blueprint.

VIEW REQUIREMENT:
Render the garment in a [FRONT VIEW].
- FRONT VIEW: show the front side of the garment only
- do not mix front and back views
- do not angle or rotate the garment
- straight-on orthographic view only

Generate a photorealistic ecommerce ghost-mannequin product image of this garment.

This must NOT look like a flat lay.
This must NOT look like the garment is lying on a surface.
This must NOT look front-pressed or two-dimensional.

The garment must appear as if it is being worn on an invisible mannequin with a swimsuit-model body shape, so the clothing shows real three-dimensional body form.

Invisible mannequin body shape requirements:
- feminine swimsuit-model proportions
- natural bust contour where applicable
- tapered waist where applicable
- realistic torso volume
- natural shoulder slope
- accurate chest, side seam, and body shaping
- body presence visible only through garment fit
- absolutely no visible mannequin or support structure

Critical anti-flat-lay requirements:
- garment must wrap around a 3D torso
- side seams must curve naturally around the body
- openings must show interior depth (neckline, armholes, leg openings)
- no flattened symmetry
- no overhead/tabletop look
- no paper-doll effect
- no floating empty shell

Garment accuracy requirements:
- treat the uploaded image as the exact product reference, not inspiration
- preserve the exact garment cut, fit, width, rise, length, flare, taper, and hem opening
- preserve fabric texture, color, print, pattern placement, seams, stitching, pockets, waistband, buttons, zipper/fly, trims, and hardware
- do not invent new flowers, graphics, textures, decorative details, labels, hardware, seams, pockets, or closures
- do not beautify, redesign, simplify, replace, or restyle the garment
- do not smooth away real wrinkles, fabric texture, fading, distressing, or construction details from the original
- if the source photo is unclear, stay conservative and keep the output closer to the uploaded garment rather than inventing a polished new design

Fit and drape requirements:
- natural gravity-based drape
- preserve the original fit and garment ease
- do not make the garment tighter, slimmer, sexier, more fitted, or more body-hugging
- do not exaggerate hips, thighs, waist, bust, chest, seat, or body contours
- realistic folds and volume without inflating or over-smoothing
- if the garment is loose, wide, straight, boxy, relaxed, or flared, keep it loose, wide, straight, boxy, relaxed, or flared

Background and styling:
- clean white studio background
- straight-on ecommerce product shot
- centered and fully visible
- high detail, soft even lighting
- no visible model, mannequin, torso, legs, skin, stand, hanger, support structure, or props
- show only the garment


Pants and jeans special rules:
- front fly, button, waistband, front pockets, rise, and leg openings must face the camera
- crop just above the waistband if needed; do not show a torso
- keep the original leg shape exactly; do not convert loose, wide, straight, bootcut, or flared pants into skinny pants or leggings
- do not stretch pants around a visible or implied body
- do not create visible hip, crotch, thigh, buttock, calf, or leg anatomy contours unless those contours are present in the original garment photo
- preserve the original hem width and opening
- keep bottom hem edges flat and fabric-like
- do not create visible feet, shoes, soles, toes, foot-shaped shadows, shoe-like shapes, hollow foot cavities, or dark oval openings at the hems
- if pant legs are hollow, show only a subtle straight fabric shadow, not a rounded interior cavity
Final requirement:
The result must clearly read as a true front-facing OR rear-facing ghost mannequin image, never a mixed or angled view.`;

const MALE_PROMPT = `Use the uploaded garment image as the exact garment blueprint.

VIEW REQUIREMENT:
Render the garment in FRONT VIEW only.
- show the front side only
- do not mix front and back views
- do not angle or rotate the garment
- straight-on orthographic view only

Generate a photorealistic ecommerce ghost-mannequin product image of this garment.

This must NOT look like a flat lay.
This must NOT look like the garment lying on a surface.
This must NOT look front-pressed or two-dimensional.

The garment must appear worn on an invisible MALE mannequin only.

Invisible mannequin body shape requirements:
- masculine torso proportions
- broad male shoulders
- straight male ribcage
- straight-to-tapered male waist

CHEST REQUIREMENT (CRITICAL):
- FLAT MALE CHEST ONLY
- visible male pectoral plane only
- slight natural pectoral definition permitted
- chest must be broad and flat, not projected
- garment must drape over a flat male chest, not breasts

ABSOLUTELY FORBIDDEN:
- no breasts
- no bust contour
- no rounded breast volume
- no convex bust projection
- no left and right breast forms
- no cleavage-like shaping
- no feminine chest anatomy
- do not create breast shapes under transparent or sheer fabric
- render sheer fabric over a flat male pectoral chest only

Critical anti-flat-lay requirements:
- garment must wrap around a 3D male torso
- side seams must curve naturally around a male body
- openings must show interior depth
- no flattened symmetry
- no overhead/tabletop look
- no paper-doll effect
- no floating empty shell

Garment accuracy requirements:
- treat the uploaded image as the exact product reference, not inspiration
- preserve the exact garment cut, fit, width, rise, length, flare, taper, and hem opening
- preserve fabric texture, color, transparency, print, pattern placement, seams, closures, trims, pockets, waistband, buttons, zipper/fly, and construction details
- do not invent new graphics, textures, decorative details, labels, hardware, seams, pockets, or closures
- do not beautify, redesign, reinterpret, simplify, replace, or restyle the garment
- do not smooth away real wrinkles, fabric texture, fading, distressing, or construction details from the original
- if the source photo is unclear, stay conservative and keep the output closer to the uploaded garment rather than inventing a polished new design

Fit and drape requirements:
- natural gravity-based drape
- preserve the original fit and garment ease
- do not make the garment tighter, slimmer, more fitted, or more body-hugging
- do not exaggerate shoulders, chest, waist, hips, thighs, seat, or body contours
- preserve natural folds and fabric behavior without stiffening, inflating, or overfilling the garment
- if the garment is loose, wide, straight, boxy, relaxed, or flared, keep it loose, wide, straight, boxy, relaxed, or flared

Background and styling:
- clean white studio background
- straight-on ecommerce product shot
- centered and fully visible
- sharp detail
- soft even professional lighting
- no visible model, mannequin, torso, legs, skin, stand, hanger, support structure, or props
- show only the garment


Pants and jeans special rules:
- front fly, button, waistband, front pockets, rise, and leg openings must face the camera
- crop just above the waistband if needed; do not show a torso
- keep the original leg shape exactly; do not convert loose, wide, straight, bootcut, or flared pants into skinny pants or leggings
- do not stretch pants around a visible or implied body
- do not create visible hip, crotch, thigh, buttock, calf, or leg anatomy contours unless those contours are present in the original garment photo
- preserve the original hem width and opening
- keep bottom hem edges flat and fabric-like
- do not create visible feet, shoes, soles, toes, foot-shaped shadows, shoe-like shapes, hollow foot cavities, or dark oval openings at the hems
- if pant legs are hollow, show only a subtle straight fabric shadow, not a rounded interior cavity
Final requirement:
The result must read instantly as premium ghost-mannequin photography on an invisible male torso with a flat male pectoral chest only, never a female bust form.`;

const FEMALE_REAR_PROMPT = `Use the uploaded garment image as the exact garment blueprint.

VIEW REQUIREMENT:
Render the garment in a [Rear VIEW].
- REAR VIEW: show the back side of the garment only
- do not mix front and back views
- do not angle or rotate the garment
- straight-on orthographic view only

Generate a photorealistic ecommerce ghost-mannequin product image of this garment.

This must NOT look like a flat lay.
This must NOT look like the garment is lying on a surface.
This must NOT look front-pressed or two-dimensional.

The garment must appear as if it is being worn on an invisible mannequin with a swimsuit-model body shape, so the clothing shows real three-dimensional body form.

Invisible mannequin body shape requirements:
- feminine swimsuit-model proportions
- natural bust contour where applicable
- tapered waist where applicable
- realistic torso volume
- natural shoulder slope
- accurate chest, side seam, and body shaping
- body presence visible only through garment fit
- absolutely no visible mannequin or support structure

Critical anti-flat-lay requirements:
- garment must wrap around a 3D torso
- side seams must curve naturally around the body
- openings must show interior depth (neckline, armholes, leg openings)
- no flattened symmetry
- no overhead/tabletop look
- no paper-doll effect
- no floating empty shell

Garment accuracy requirements:
- treat the uploaded image as the exact product reference, not inspiration
- preserve the exact garment cut, fit, width, rise, length, flare, taper, and hem opening
- preserve fabric texture, color, print, pattern placement, seams, stitching, pockets, waistband, buttons, zipper/fly, trims, and hardware
- do not invent new flowers, graphics, textures, decorative details, labels, hardware, seams, pockets, or closures
- do not beautify, redesign, simplify, replace, or restyle the garment
- do not smooth away real wrinkles, fabric texture, fading, distressing, or construction details from the original
- if the source photo is unclear, stay conservative and keep the output closer to the uploaded garment rather than inventing a polished new design

Fit and drape requirements:
- natural gravity-based drape
- preserve the original fit and garment ease
- do not make the garment tighter, slimmer, sexier, more fitted, or more body-hugging
- do not exaggerate hips, thighs, waist, bust, chest, seat, or body contours
- realistic folds and volume without inflating or over-smoothing
- if the garment is loose, wide, straight, boxy, relaxed, or flared, keep it loose, wide, straight, boxy, relaxed, or flared

Background and styling:
- clean white studio background
- straight-on ecommerce product shot
- centered and fully visible
- high detail, soft even lighting
- no visible model, mannequin, torso, legs, skin, stand, hanger, support structure, or props
- show only the garment


Pants and jeans special rules:
- front fly, button, waistband, front pockets, rise, and leg openings must face the camera
- crop just above the waistband if needed; do not show a torso
- keep the original leg shape exactly; do not convert loose, wide, straight, bootcut, or flared pants into skinny pants or leggings
- do not stretch pants around a visible or implied body
- do not create visible hip, crotch, thigh, buttock, calf, or leg anatomy contours unless those contours are present in the original garment photo
- preserve the original hem width and opening
- keep bottom hem edges flat and fabric-like
- do not create visible feet, shoes, soles, toes, foot-shaped shadows, shoe-like shapes, hollow foot cavities, or dark oval openings at the hems
- if pant legs are hollow, show only a subtle straight fabric shadow, not a rounded interior cavity
Final requirement:
The result must clearly read as a true front-facing OR rear-facing ghost mannequin image, never a mixed or angled view.`;

const MALE_REAR_PROMPT = `Use the uploaded garment image as the exact garment blueprint.
The uploaded image is the BACK SIDE of the garment photographed facing the camera as a standard product image.

Generate a photorealistic ecommerce ghost-mannequin image showing an invisible MALE mannequin viewed FROM BEHIND.

CRITICAL ORIENTATION REQUIREMENT:
- the camera must be looking at the mannequin's back
- the mannequin must be facing away from the camera
- show the back of the invisible male mannequin only
- show the uploaded garment being worn on the mannequin's back
- do not generate a front-facing mannequin
- do not rotate to a front view
- do not mix front and back information
- straight-on rear view only
- no angled or 3/4 rear view

Generate true ghost-mannequin photography, not a flat lay.
The garment must appear worn on an invisible mannequin with realistic MALE body shape only.

Invisible mannequin body shape requirements:
- masculine back proportions
- broad male shoulders
- natural upper back contour
- subtle male shoulder blade structure where applicable
- straight male ribcage
- straight-to-tapered male waist where applicable
- realistic male back torso volume
- side seams wrapping naturally around a male body
- body presence visible only through garment fit
- absolutely no visible mannequin structure

Critical anti-flat-lay requirements:
- garment must wrap around a 3D male back torso
- rear neckline and armholes must show interior depth where applicable
- no flattened symmetry
- no tabletop or laid-flat appearance
- no paper-doll effect
- no floating empty shell

Garment accuracy requirements:
- preserve the uploaded back view exactly
- preserve all back-specific details exactly
- preserve seams, closures, cutouts, trims, hardware, fabric texture, and pattern placement
- do not redesign or simplify anything

Fit and drape requirements:
- natural gravity-based drape
- realistic tension from shoulders through upper back and torso
- preserve natural folds and fabric behavior
- do not stiffen, inflate, or overfill the garment

Background and styling:
- clean white studio background
- centered ecommerce product shot
- soft even professional lighting
- no model
- no hanger
- no props


Pants and jeans special rules:
- front fly, button, waistband, front pockets, rise, and leg openings must face the camera
- crop just above the waistband if needed; do not show a torso
- keep the original leg shape exactly; do not convert loose, wide, straight, bootcut, or flared pants into skinny pants or leggings
- do not stretch pants around a visible or implied body
- do not create visible hip, crotch, thigh, buttock, calf, or leg anatomy contours unless those contours are present in the original garment photo
- preserve the original hem width and opening
- keep bottom hem edges flat and fabric-like
- do not create visible feet, shoes, soles, toes, foot-shaped shadows, shoe-like shapes, hollow foot cavities, or dark oval openings at the hems
- if pant legs are hollow, show only a subtle straight fabric shadow, not a rounded interior cavity
Final requirement:
The final image must read instantly as premium ghost-mannequin photography photographed from behind, showing an invisible male mannequin's back wearing the uploaded back-view garment.`;

export async function POST(req) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image_file');
    const gender = formData.get('gender') || 'female';
    const view = formData.get('view') || 'front';
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

    console.log('[ghost-mannequin] request received', {
      receivedBytes: imageFile.size, mimeType: imageFile.type, gender, view,
    });

    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    let prompt;
    if (gender === 'male' && view === 'rear') prompt = MALE_REAR_PROMPT;
    else if (gender === 'female' && view === 'rear') prompt = FEMALE_REAR_PROMPT;
    else if (gender === 'male') prompt = MALE_PROMPT;
    else prompt = FEMALE_PROMPT;

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
