import sharp from "sharp";

const crops = [
  {
    input: "assets/cookies/choc-chip-cookie/turntable-natural/frame-08.png",
    output: "assets/cookies/choc-chip-cookie/catalog.png",
    region: { left: 12, top: 225, width: 1236, height: 831 },
  },
  {
    input: "assets/cookies/biscoff-white-chocolate-cookie/turntable-natural/frame-01.png",
    output: "assets/cookies/biscoff-white-chocolate-cookie/catalog.png",
    region: { left: 25, top: 259, width: 1204, height: 733 },
  },
];

for (const { input, output, region } of crops) {
  await sharp(input).extract(region).png().toFile(output);
}