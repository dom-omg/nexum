import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['z3-solver'],
  turbopack: {},
};

export default nextConfig;
