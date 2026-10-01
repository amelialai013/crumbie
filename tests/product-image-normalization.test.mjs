import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { normalizeProductImage } from "../lib/product-image-normalization.ts";

async function reference(size, padding) {
  return sharp({ create: { width: size, height: Math.floor(size / 2), channels: 4, background: { r: 190, g: 120, b: 60, alpha: 1 } } })
    .extend({ top: padding, bottom: padding, left: padding, right: padding, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

test("cover size is independent of model canvas padding and source resolution", async () => {
  const compact = await normalizeProductImage(await reference(200, 10), "cover");
  const padded = await normalizeProductImage(await reference(600, 450), "cover");
  for (const image of [compact, padded]) {
    const { width, height } = await sharp(image).metadata();
    assert.equal(width, 1536); assert.equal(height, 1024);
    const subject = await sharp(image).trim().toBuffer({ resolveWithObject: true });
    assert.equal(subject.info.width, 1382);
    const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < info.height; y++) {
      assert.equal(data[(y * info.width) * 4 + 3], 0);
      assert.equal(data[(y * info.width + info.width - 1) * 4 + 3], 0);
    }
  }
});

test("rotation frames retain square dimensions and safe margins", async () => {
  const image = await normalizeProductImage(await reference(200, 200), "rotation");
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.width, 1024); assert.equal(metadata.height, 1024);
  assert.equal((await sharp(image).trim().toBuffer({ resolveWithObject: true })).info.width, 922);
});
