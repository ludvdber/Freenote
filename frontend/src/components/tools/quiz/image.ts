/**
 * Read an image file, downscale it and return a compressed base64 data URI (JPEG). Kept well under the
 * backend's per-image cap so a published quiz stays reasonable; images are never put in a share link.
 */
export async function fileToDataUrl(file: File, maxSide = 900, maxBytes = 160_000): Promise<string> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(img, 0, 0, w, h);

  let quality = 0.85;
  let url = canvas.toDataURL('image/jpeg', quality);
  while (url.length > maxBytes && quality > 0.3) {
    quality -= 0.15;
    url = canvas.toDataURL('image/jpeg', quality);
  }
  return url;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable image')); };
    img.src = url;
  });
}
