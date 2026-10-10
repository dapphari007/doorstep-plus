/** @type {import('next').NextConfig} */
module.exports = {
  // Lets a second dev server (tests, evals) build into its own folder.
  distDir: process.env.NEXT_DIST_DIR || '.next',
}
