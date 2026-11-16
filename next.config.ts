import type { NextConfig } from "next";
import { siteUrl } from "./lib/site";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
    qualities: [75, 100],
  },
  async redirects() {
    // Alternate domains permanently redirect to the canonical site so search engines index a single domain.
    const alternateHosts = ["www.clubcrumbie.com", "crumbie.com.au", "www.crumbie.com.au"].filter((host) => host !== new URL(siteUrl).host);
    const hostRedirects = alternateHosts.map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: `${siteUrl}/:path*`,
      // Search Console's change-of-address check requires a literal 301 (permanent: true sends 308).
      statusCode: 301 as const,
    }));
    return [
      ...hostRedirects,
      { source: "/cookies", destination: "/crumbs", permanent: true },
      { source: "/cookies/:slug", destination: "/crumbs/:slug", permanent: true },
      { source: "/crumb-selection", destination: "/crumbs", permanent: true },
      { source: "/crumb-selection/:slug", destination: "/crumbs/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
