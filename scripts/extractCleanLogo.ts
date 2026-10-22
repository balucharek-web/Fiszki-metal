import sharp from 'sharp';

async function main() {
  await sharp('public/assets/aistudio/fiszka_meblowa_5010b6c7.png')
    .extract({ left: 100, top: 20, width: 1100, height: 880 })
    .toFile('public/assets/standers_logo_clean.png');

  console.log('Saved clean 1:1 original scan logo');
}

main().catch(console.error);
