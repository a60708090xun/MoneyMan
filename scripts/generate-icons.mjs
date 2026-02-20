import sharp from 'sharp'
import { writeFileSync } from 'fs'

// Create MoneyMan icon: green circle with "$" symbol
function createSvg(size) {
  const fontSize = Math.round(size * 0.5)
  const cy = Math.round(size * 0.52)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.2)}" fill="#4CAF50"/>
  <text x="50%" y="${cy}" text-anchor="middle" dominant-baseline="central"
        font-family="Arial,sans-serif" font-weight="bold" font-size="${fontSize}" fill="white">$</text>
</svg>`
}

for (const size of [192, 512]) {
  const svg = Buffer.from(createSvg(size))
  await sharp(svg).png().toFile(`public/icons/icon-${size}.png`)
  console.log(`Generated icon-${size}.png`)
}

// Also generate a favicon
const faviconSvg = Buffer.from(createSvg(32))
await sharp(faviconSvg).png().toFile('public/favicon.png')
console.log('Generated favicon.png')
