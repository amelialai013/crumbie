import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const assetRoots = [
  "assets/cookies/choc-chip-cookie/turntable-clean",
  "assets/cookies/biscoff-white-chocolate-cookie/turntable-clean",
];

function isMattePixel(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  return Math.min(red, green, blue) > 170 && Math.max(red, green, blue) - Math.min(red, green, blue) < 42;
}

for (const root of assetRoots) {
  const outputRoot = root.replace(/turntable-clean$/, "turntable-natural");
  await mkdir(outputRoot, { recursive: true });
  const files = (await readdir(root)).filter((file) => file.endsWith(".png"));

  for (const file of files) {
    const inputPath = path.join(root, file);
    const outputPath = path.join(outputRoot, file);
    const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const visited = new Uint8Array(info.width * info.height);
    const queue = [];

    for (let x = 0; x < info.width; x += 1) {
      queue.push(x, x + (info.height - 1) * info.width);
    }
    for (let y = 1; y < info.height - 1; y += 1) {
      queue.push(y * info.width, info.width - 1 + y * info.width);
    }

    while (queue.length > 0) {
      const index = queue.pop();
      if (visited[index]) continue;
      visited[index] = 1;
      const offset = index * info.channels;
      const alpha = data[offset + 3];
      if (alpha !== 0 && !isMattePixel(data, offset)) continue;
      if (isMattePixel(data, offset)) data[offset + 3] = 0;

      const x = index % info.width;
      const y = Math.floor(index / info.width);
      if (x > 0) queue.push(index - 1);
      if (x < info.width - 1) queue.push(index + 1);
      if (y > 0) queue.push(index - info.width);
      if (y < info.height - 1) queue.push(index + info.width);
    }

    await sharp(data, { raw: info }).png().toFile(outputPath);
  }
}