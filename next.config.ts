import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
    qualities: [75, 100],
  },
  async redirects() {
    return [
      { source: "/cookies", destination: "/crumbs", permanent: true },
      { source: "/cookies/:slug", destination: "/crumbs/:slug", permanent: true },
      { source: "/crumb-selection", destination: "/crumbs", permanent: true },
      { source: "/crumb-selection/:slug", destination: "/crumbs/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
