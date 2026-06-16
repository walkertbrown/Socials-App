import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep sharp (a native binary) out of the bundled server output.
  serverExternalPackages: ["sharp", "pdf-to-img", "pdfjs-dist"],
};

export default nextConfig;
