const isGitHubPages = process.env.GITHUB_PAGES === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: isGitHubPages ? "export" : undefined,
  basePath: isGitHubPages ? "/Docsie" : "",
  assetPrefix: isGitHubPages ? "/Docsie/" : undefined,
  images: {
    unoptimized: true,
  },
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  turbopack: {},
};

export default nextConfig;
