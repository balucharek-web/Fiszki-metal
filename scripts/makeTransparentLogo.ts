import sharp from 'sharp';

async function main() {
  // Crop tightly around the logo
  const input = await sharp('public/assets/aistudio/fiszka_meblowa_5010b6c7.png')
    .extract({ left: 140, top: 120, width: 980, height: 620 })
    .toBuffer();

  // Convert near-white background to transparent
  const image = sharp(input);
  const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // If pixel is paper/white (r,g,b > 230), make it pure white or transparent
    if (r > 225 && g > 225 && b > 225) {
      data[i + 3] = 0; // Transparent background
    } else {
      // Enhance contrast of black mark
      const avg = (r + g + b) / 3;
      if (avg < 140) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
  }

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toFile('public/assets/standers_logo.png');

  console.log('Saved transparent 1:1 standers logo to public/assets/standers_logo.png');
}

main().catch(console.error);
