import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  // Netlify deployment configuration
  images: {
    unoptimized: true, // Required for static export on Netlify
  },
};

export default nextConfig;
