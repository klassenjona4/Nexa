import QR from 'qrcode';
import { useMemo } from 'react';

// Rendered as SVG paths from the qrcode module matrix: no images, no inline HTML.
export function QRCode({ value, label }: { value: string; label: string }) {
  const { size, d } = useMemo(() => {
    const qr = QR.create(value, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    let path = '';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.modules.get(x, y)) path += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { size: n, d: path };
  }, [value]);
  return (
    <svg viewBox={`-2 -2 ${size + 4} ${size + 4}`} width="100%" height="100%" role="img" aria-label={label} shapeRendering="crispEdges">
      <rect x={-2} y={-2} width={size + 4} height={size + 4} fill="#FFFFFF" />
      <path d={d} fill="#141414" />
    </svg>
  );
}
