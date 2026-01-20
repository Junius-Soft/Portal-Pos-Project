/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
        port: '8000',
        pathname: '/**',
      },
    ],
  },
  // pdfjs-dist için webpack config
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Server-side için canvas'ı external olarak işaretle
      config.externals = config.externals || [];
      config.externals.push({
        'canvas': 'commonjs canvas',
      });
    }
    return config;
  },
};

module.exports = nextConfig;
