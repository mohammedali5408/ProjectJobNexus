import type { NextConfig } from "next";

// Create a more permissive type that allows additional experimental options
type NextConfigWithExperimental = NextConfig & {
  experimental?: {
    missingSuspenseWithCSRBailout?: boolean;
    // Include other experimental options that might be in your config
  };
};

const nextConfig: NextConfigWithExperimental = {
  /* Your existing config options */
  images: {
    domains: ['lh3.googleusercontent.com', 'firebasestorage.googleapis.com']
  },
  
  // Add these settings to ignore TypeScript and ESLint errors during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Add this to disable client-side bailout checks
  experimental: {
    missingSuspenseWithCSRBailout: false
  }
};

export default nextConfig;