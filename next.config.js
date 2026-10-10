/** @type {import('next').NextConfig} */
module.exports = {
  // Lets a second dev server (tests, evals) build into its own folder.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Self-contained server for the Lambda container (Dockerfile.lambda).
  ...(process.env.NEXT_STANDALONE === 'true' ? { output: 'standalone' } : {}),
  async redirects() {
    return [{ source: '/recall', destination: '/ask', permanent: true }]
  },
}
