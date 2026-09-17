"use client";

import { usePathname } from "next/navigation";
import PageLoader from "@/components/page-loader";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const transitionClass = pathname === "/cart" ? "page-transition cart-page-transition" : "page-transition";

  return <div key={pathname} className={transitionClass}><PageLoader />{children}</div>;
}
