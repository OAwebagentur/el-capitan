/** @type {import('next').NextConfig} */
const nextConfig = {
  // Match WordPress' trailing-slash URLs so internal links (e.g. /buchung/) resolve 1:1.
  trailingSlash: true,
  // We serve byte-identical mirrored documents; no image optimization needed.
  images: { unoptimized: true },
  reactStrictMode: false,
};

export default nextConfig;
