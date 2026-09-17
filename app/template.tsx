"use client";

import { usePathname } from "next/navigation";
import PageLoader from "@/components/page-loader";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const transitionClass = pathname === "/"
    ? "page-transition"
    : pathname === "/cookies"
      ? "page-transition secondary-page-transition catalog-page-transition"
      : "page-transition secondary-page-transition";

  return <><PageLoader /><div key={pathname} className={transitionClass}>{children}</div></>;
}
