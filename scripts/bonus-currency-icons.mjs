import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

// Match the former white/black drop-shadow chain once, rather than on every card.
// Four pixels per CSS pixel keep the small badges sharp on high-density displays.
const scale = 4;
const iconSize = 28 * scale;
const padding = 2 * scale;
const size = iconSize + padding * 2;
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const shadows = [
  [1, 0, 255], [-1, 0, 255], [0, 1, 255], [0, -1, 255],
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]
];

function addShadow(pixels, dx, dy, colour) {
  const output = Buffer.from(pixels);
  for (let y = 0; y < size; y += 1) {
    const sourceY = y - dy;
    if (sourceY < 0 || sourceY >= size) continue;
    for (let x = 0; x < size; x += 1) {
      const sourceX = x - dx;
      if (sourceX < 0 || sourceX >= size) continue;
      const offset = (y * size + x) * 4;
      const alpha = pixels[offset + 3] / 255;
      const shadowAlpha = pixels[(sourceY * size + sourceX) * 4 + 3] / 255 * (1 - alpha);
      if (shadowAlpha === 0) continue;
      const combinedAlpha = alpha + shadowAlpha;
      for (let channel = 0; channel < 3; channel += 1) {
        output[offset + channel] = Math.round((pixels[offset + channel] * alpha + colour * shadowAlpha) / combinedAlpha);
      }
      output[offset + 3] = Math.round(combinedAlpha * 255);
    }
  }
  return output;
}

export async function generateBonusCurrencyIcons(source, destination) {
  await mkdir(destination, { recursive: true });
  const icons = (await readdir(source, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'));

  for (let index = 0; index < icons.length; index += 4) {
    await Promise.all(icons.slice(index, index + 4).map(async ({ name }) => {
      let pixels = await sharp(join(source, name))
        .resize(iconSize, iconSize, { fit: 'contain', background: transparent })
        .extend({ top: padding, bottom: padding, left: padding, right: padding, background: transparent })
        .toColourspace('srgb').ensureAlpha().raw().toBuffer();
      for (const [dx, dy, colour] of shadows) pixels = addShadow(pixels, dx * scale, dy * scale, colour);
      await sharp(pixels, { raw: { width: size, height: size, channels: 4 } })
        .png().toFile(join(destination, name));
    }));
  }
}
