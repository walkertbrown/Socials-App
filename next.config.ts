import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep sharp (a native binary) out of the bundled server output.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
