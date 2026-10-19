const src = (await import('fs')).readFileSync('src/scripts/ring.js', 'utf8');
const body = src.slice(src.indexOf('const PAD'), src.indexOf('// Other scroll animations'));
const C = { imageWidth: 300, imageHeight: 300, spacing: 2, perspective: 3000 };
const f = new Function('C', body.replace('const boundsCache', 'var boundsCache') + '; return { measureBounds, radiusOf };')(C);
for (const T of [15, 10, 6, 4, 0]) { const b = f.measureBounds({ ...C, tiltStart: -T, tiltEnd: T }, 8); console.log(T, 'halfW', b.halfW.toFixed(0), 'h', (b.maxY - b.minY).toFixed(0), 'minY', b.minY.toFixed(0), 'maxY', b.maxY.toFixed(0)); }
for (const t of [-15, -10, -6, 0, 6, 10, 15]) { const b = f.measureBounds({ ...C, tiltStart: t, tiltEnd: t }, 8); console.log('tilt', t, 'up', (-b.minY).toFixed(0), 'down', b.maxY.toFixed(0)); }
