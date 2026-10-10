import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Cache Components / PPR are left off: later phases rely on per-request
  // session data (auth cookies, live cart/order state) on most routes, which
  // works more simply under standard dynamic rendering than under the
  // cached-by-default model.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
