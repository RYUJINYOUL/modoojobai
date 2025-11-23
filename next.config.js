/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack 설정 (빈 객체라도 있어야 함)
  turbopack: {},
  
  // webpack 설정 제거 또는 조건부로 사용
  // webpack: (config, { isServer }) => {
  //   config.resolve.symlinks = false
  //   return config
  // },
}

module.exports = nextConfig