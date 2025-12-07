/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Advertencia: Esto permite que las compilaciones de producción se completen con éxito
    // incluso si tu proyecto tiene errores de ESLint.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! ADVERTENCIA !!
    // Peligrosamente permite que las compilaciones de producción se completen con éxito
    // incluso si tu proyecto tiene errores de tipo.
    ignoreBuildErrors: true,
  },
  experimental: {
     // Esto ayuda a reducir el uso de memoria
     workerThreads: false,
     cpus: 1
  }
};

export default nextConfig;
