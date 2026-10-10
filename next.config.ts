import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: {
    position: "bottom-right",
  },
  // Next streams metadata into <body> for browsers (only these "bots" get it
  // in <head>), but Chrome and Safari read the manifest link, theme color and
  // home-screen tags only from <head>, which installing as an app needs.
  // Nestery's metadata is static, so streaming it gains nothing.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
