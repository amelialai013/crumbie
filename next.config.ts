import type { NextConfig } from "next";
import { siteUrl } from "./lib/site";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
    qualities: [75, 100],
  },
  async rewrites() {
    const origin = (process.env.R2_MEDIA_ORIGIN || "https://pub-fea5209176ba412da081e64534c01cc7.r2.dev").replace(/\/$/, "");
    return [{ source: "/media/:path*", destination: `${origin}/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
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
      { source: "/ordering-policy", destination: "/faqs", permanent: true },
    ];
  },
};

export default nextConfig;
