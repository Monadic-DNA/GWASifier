/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["react", "react-dom"]
  }
};

export default nextConfig;
