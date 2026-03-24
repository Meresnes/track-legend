import type { NextConfig } from "next";

const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 200);

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: `${Number.isFinite(maxUploadMb) ? maxUploadMb : 200}mb`,
  },
};

export default nextConfig;
