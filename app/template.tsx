"use client";

import { usePathname } from "next/navigation";
import PageLoader from "@/components/page-loader";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const transitionClass = pathname === "/"
    ? "page-transition"
    : "page-transition cart-page-transition";

  return <><PageLoader /><div key={pathname} className={transitionClass}>{children}</div></>;
}
