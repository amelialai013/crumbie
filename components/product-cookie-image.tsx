import Image from "next/image";

import signatureSide from "@/assets/cookies/choc-chip-cookie/turntable-natural/frame-08.png";
import biscoffSide from "@/assets/cookies/biscoff-white-chocolate-cookie/turntable-natural/frame-01.png";

export default function ProductCookieImage({ name, variant }: { name: string; variant: "signature" | "biscoff" }) {
  return (
    <Image
      src={variant === "biscoff" ? biscoffSide : signatureSide}
      alt={`${name}, side profile`}
      className={`product-cookie-image product-cookie-image-${variant}`}
      fill
      sizes="(max-width: 640px) 100vw, 50vw"
    />
  );
}
