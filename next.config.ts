import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const baseConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
};

export default function nextConfig(phase: string) {
  if (phase === PHASE_PRODUCTION_BUILD) {
    const env = process.env as NodeJS.ProcessEnv & { NODE_ENV?: string };
    env.NODE_ENV = "production";
  }

  return baseConfig;
}
