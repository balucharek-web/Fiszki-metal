import sharp from 'sharp';

async function main() {
  const metadata = await sharp('public/assets/aistudio/fiszka_meblowa_5010b6c7.png').metadata();
  console.log('Image dimensions:', metadata.width, metadata.height);

  // Logo region is approximately x: 100 to 1250, y: 100 to 800
  // Let's crop the Standers logo
  // In a 4607 x 924 image:
  // Logo is on the left:
  // width: ~1100, height: ~700
  await sharp('public/assets/aistudio/fiszka_meblowa_5010b6c7.png')
    .extract({ left: 120, top: 100, width: 1050, height: 680 })
    .toFile('public/assets/standers_logo_raw.png');

  console.log('Saved raw logo crop');
}

main().catch(console.error);
