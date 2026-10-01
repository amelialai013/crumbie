import Image from "next/image";

import signatureSide from "@/assets/cookies/choc-chip-cookie/catalog-normalized.png";
import biscoffSide from "@/assets/cookies/biscoff-white-chocolate-cookie/catalog-normalized.png";

export default function ProductCookieImage({
  eager = false,
  image,
  name,
  variant,
}: {
  eager?: boolean;
  image?: string;
  name: string;
  variant: "signature" | "biscoff";
}) {
  return (
    <Image
      src={image || (variant === "biscoff" ? biscoffSide : signatureSide)}
      alt={`${name} cookie`}
      className={`product-cookie-image product-cookie-image-${variant}${image ? " product-cookie-image-generated" : ""}${image?.match(/\.png(?:$|\?)/i) ? " product-cookie-image-transparent" : ""}${image?.match(/\.jpe?g(?:$|\?)/i) ? " product-cookie-image-legacy-jpeg" : ""}`}
      fill
      loading={eager ? "eager" : undefined}
      unoptimized={Boolean(image)}
      sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
    />
  );
}
