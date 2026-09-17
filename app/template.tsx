"use client";

import { usePathname } from "next/navigation";
import PageMotion from "@/components/page-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <PageMotion key={pathname}>{children}</PageMotion>;
}
