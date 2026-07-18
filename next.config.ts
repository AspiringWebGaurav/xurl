import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Allow local network IP for testing on physical mobile devices
  allowedDevOrigins: ["192.168.0.154"],
};

export default nextConfig;
