/**
 * HiDPI キャンバス設定（スマホ Retina 等で画像がぼやけないようにする）
 * 内部バッファを devicePixelRatio 倍にし、描画座標は CSS ピクセル単位のまま使う。
 */
function setupCanvas2D(canvas, cssW, cssH) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = Math.max(1, Math.floor(cssW * dpr));
  const h = Math.max(1, Math.floor(cssH * dpr));
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality !== undefined) {
    ctx.imageSmoothingQuality = 'high';
  }
  return { cssW, cssH, dpr, ctx };
}
