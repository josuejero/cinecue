import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const baseConfig: NextConfig = {
  reactCompiler: true,
};

export default function nextConfig(phase: string) {
  if (phase === PHASE_PRODUCTION_BUILD) {
    const env = process.env as NodeJS.ProcessEnv & { NODE_ENV?: string };
    env.NODE_ENV = "production";
  }

  return baseConfig;
}
