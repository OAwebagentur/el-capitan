/** @type {import('next').NextConfig} */
const DIRS21 = "https://reservation.one.dirs21.de/el-capitan/result";

const nextConfig = {
  // Match WordPress' trailing-slash URLs so internal links (e.g. /impressum/) resolve 1:1.
  trailingSlash: true,
  // We serve byte-identical mirrored documents; no image optimization needed.
  images: { unoptimized: true },
  reactStrictMode: false,
  // Gebucht wird ausschliesslich ueber dirs21. Die frühere Seite /buchung/
  // (eigenes Formular + ibelsa-Widget) gibt es nicht mehr; alte Links,
  // Lesezeichen und Google-Treffer landen direkt in der Buchungsstrecke.
  async redirects() {
    return [
      { source: "/buchung", destination: DIRS21, permanent: true },
      { source: "/buchung/:path*", destination: DIRS21, permanent: true },
    ];
  },
};

export default nextConfig;
