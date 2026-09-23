import Image from "next/image";

import signatureSide from "@/assets/cookies/choc-chip-cookie/catalog.png";
import biscoffSide from "@/assets/cookies/biscoff-white-chocolate-cookie/catalog.png";

export default function ProductCookieImage({
  image,
  name,
  variant,
}: {
  image?: string;
  name: string;
  variant: "signature" | "biscoff";
}) {
  return (
    <Image
      src={image || (variant === "biscoff" ? biscoffSide : signatureSide)}
      alt={`${name}, side profile`}
      className={`product-cookie-image product-cookie-image-${variant}${image ? " product-cookie-image-generated" : ""}${image?.match(/\.png(?:$|\?)/i) ? " product-cookie-image-transparent" : ""}${image?.match(/\.jpe?g(?:$|\?)/i) ? " product-cookie-image-legacy-jpeg" : ""}`}
      fill
      unoptimized={Boolean(image)}
      sizes="(max-width: 640px) 100vw, 50vw"
    />
  );
}
