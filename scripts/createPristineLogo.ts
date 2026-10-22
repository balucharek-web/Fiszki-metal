import sharp from 'sharp';

async function main() {
  const image = sharp('public/assets/standers_logo_clean.png');
  const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });

  // In the scan:
  // Paper is around r,g,b in [230..255]
  // Black ink is around r,g,b in [0..120]
  // Midtones are antialiased edges
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

    if (luminance >= 220) {
      // Pure white paper -> fully transparent
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 0;
    } else if (luminance <= 100) {
      // Solid black ink -> pure black
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    } else {
      // Edge transition -> black with alpha proportional to darkness
      const alpha = Math.round(255 * (1 - (luminance - 100) / 120));
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = alpha;
    }
  }

  // Trim transparent borders
  const trimmedBuffer = await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .trim()
    .toBuffer();

  // Save as public/assets/standers_logo_transparent.png
  await sharp(trimmedBuffer)
    .toFile('public/assets/standers_logo_transparent.png');

  // Also save with pure white background as public/assets/standers_logo_white.png
  await sharp(trimmedBuffer)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toFile('public/assets/standers_logo_white.png');

  console.log('Successfully created clean transparent and pure-white logo!');
}

main().catch(console.error);
