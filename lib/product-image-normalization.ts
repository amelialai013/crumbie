import sharp from "sharp";

/** Size the visible subject, not the transparent canvas returned by the model.
 * Covers share a 3:2 canvas with 5% safe margins; rotation frames stay square.
 */
export async function normalizeProductImage(bytes: Uint8Array, view: "cover" | "rotation") {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      // Ignore near-invisible shadows when measuring the cookie's size.
      if (data[(y * info.width + x) * 4 + 3] < 32) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error("The generated image has no visible cookie.");
  const width = view === "cover" ? 1536 : 1024;
  const height = 1024;
  const marginX = Math.round(width * .05), marginY = Math.round(height * .05);
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  return sharp(bytes)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(width - marginX * 2, height - marginY * 2, { fit: "contain", background: transparent })
    .extend({ left: marginX, right: marginX, top: marginY, bottom: marginY, background: transparent })
    .png().toBuffer();
}
