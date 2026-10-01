import sharp from "sharp";

// Orbit around the cookie's horizontal axis: top -> front edge -> bottom
// -> rear edge -> top. The cover is separate from the eight-frame orbit.
export const rotationViews = [
  { label: "Side-profile cover", minRatio: 0.08, maxRatio: 0.5, prompt: "Exact edge-on SIDE PROFILE. Camera level with the cookie edge. Only its thin horizontal edge and thickness are visible. The top must NOT face the camera. Silhouette must be a wide, thin horizontal shape, never a round top view." },
  { label: "Top · 0°", minRatio: 0.75, maxRatio: 1.3, prompt: "TOP view, camera straight above the cookie, looking directly down at its circular topping face. This is orbit angle 0 degrees." },
  { label: "Front upper · 45°", minRatio: 0.4, maxRatio: 0.88, prompt: "Orbit angle 45 degrees: camera above the FRONT edge, looking down at 45 degrees. Top face is foreshortened into a horizontal oval; front edge and thickness are clearly visible. Not a bird's-eye view." },
  { label: "Front edge · 90°", minRatio: 0.08, maxRatio: 0.4, prompt: "Orbit angle 90 degrees: EXACT FRONT EDGE-ON view, camera level with the cookie. Only a thin horizontal edge and thickness visible. Neither top nor underside face points towards camera. No round face visible." },
  { label: "Front underside · 135°", minRatio: 0.4, maxRatio: 0.88, prompt: "Orbit angle 135 degrees: camera BELOW the FRONT edge looking upward at 45 degrees. Show the BAKED UNDERSIDE as a foreshortened horizontal oval and the front rim. TOPPING FACE IS HIDDEN on the opposite side. Underside is golden baked cookie, not a copy of the decorated top." },
  { label: "Bottom · 180°", minRatio: 0.75, maxRatio: 1.3, prompt: "Orbit angle 180 degrees: camera directly BELOW the cookie looking straight up at its complete flat BAKED BOTTOM. Only the underside faces the camera. Top toppings hidden. Show toasted golden biscuit underside, not the decorated top face." },
  { label: "Rear underside · 225°", minRatio: 0.4, maxRatio: 0.88, prompt: "Orbit angle 225 degrees: camera BELOW the REAR edge looking upward at 45 degrees. Show foreshortened BAKED UNDERSIDE and rear rim. Top face is hidden. Opposite edge from the front underside view." },
  { label: "Rear edge · 270°", minRatio: 0.08, maxRatio: 0.4, prompt: "Orbit angle 270 degrees: EXACT REAR EDGE-ON view, camera level with cookie, opposite the front edge. Show only thin horizontal rear edge and thickness. No round top face or underside visible." },
  { label: "Rear upper · 315°", minRatio: 0.4, maxRatio: 0.88, prompt: "Orbit angle 315 degrees: camera ABOVE the REAR edge, looking down at 45 degrees. Show foreshortened oval TOP and rear rim, opposite the front upper view. Turn the cookie 180 degrees relative to the front-upper reference before photographing it. The top should be a wide horizontal oval, about 65% as tall as it is wide. This closes the orbit back to the top at 360 degrees." },
] as const;

export async function rotationFrameIssue(bytes: Uint8Array, index: number, previous: Uint8Array[] = []) {
  const view = rotationViews[index];
  if (!view) return "Unknown rotation angle.";
  const { data, info } = await sharp(bytes).toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] < 96) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < left) return "No visible cookie was returned.";
  const ratio = (bottom - top + 1) / (right - left + 1);
  if (ratio < view.minRatio || ratio > view.maxRatio) return `${view.label} has the wrong silhouette (height/width ${ratio.toFixed(2)}). Required range ${view.minRatio}–${view.maxRatio}. Change the camera elevation, not just the toppings or the cookie's in-plane rotation.`;
  const thumbnail = async (image: Uint8Array) => sharp(image).toColourspace("srgb").ensureAlpha().resize(32,32,{fit:"fill"}).raw().toBuffer();
  const candidate = await thumbnail(bytes);
  for (const image of previous) {
    const other = await thumbnail(image);
    let distance = 0, samples = 0;
    for (let i = 0; i < candidate.length; i += 4) {
      if (candidate[i + 3] < 32 && other[i + 3] < 32) continue;
      for (let channel = 0; channel < 4; channel++) { distance += Math.abs(candidate[i + channel] - other[i + channel]); samples++; }
    }
    if (samples && distance / samples / 255 < .035) return "This repeats an existing frame. Show the specified opposite face or edge, preserving the cookie identity.";
  }
  return null;
}
