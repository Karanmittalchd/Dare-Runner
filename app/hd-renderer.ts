// Cached sprite preparation keeps image processing out of the animation loop.
export type SpriteSet = { frames: HTMLCanvasElement[] };
export function loadSprites(url: string): SpriteSet {
  const result: SpriteSet = { frames: [] };
  const atlas = new Image();
  atlas.onload = () => {
    const width = Math.floor(atlas.naturalWidth / 3);
    const splitY = Math.floor(atlas.naturalHeight * 0.45);
    for (let index = 0; index < 6; index++) {
      const height = index < 3 ? splitY : atlas.naturalHeight - splitY;
      const cell = document.createElement('canvas'); cell.width = width; cell.height = height;
      const context = cell.getContext('2d', { willReadFrequently: true }); if (!context) continue;
      context.drawImage(atlas, (index % 3) * width, (index < 3 ? 0 : splitY), width, height, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height);
      // Follow smooth edge-connected backdrop pixels, stopping at crisp sprite contours.
      const count = width * height;
      const edge = new Uint8Array(count); const barrier = new Uint8Array(count);
      for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
        const n = y * width + x;
        let gradient = 0;
        for (let c = 0; c < 3; c++) {
          const dx = Math.abs(pixels.data[(n + 1) * 4 + c] - pixels.data[(n - 1) * 4 + c]);
          const dy = Math.abs(pixels.data[(n + width) * 4 + c] - pixels.data[(n - width) * 4 + c]);
          gradient = Math.max(gradient, dx + dy);
        }
        if (gradient > 24) edge[n] = 1;
      }
      for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) if (edge[y * width + x]) {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) barrier[(y + dy) * width + x + dx] = 1;
      }
      const queue: number[] = []; const seen = new Uint8Array(count);
      const visit = (n: number) => {
        if (n < 0 || n >= count || seen[n] || barrier[n]) return;
        seen[n] = 1; pixels.data[n * 4 + 3] = 0; queue.push(n);
      };
      for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
      for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
      for (let q = 0; q < queue.length; q++) { const n = queue[q]; if (n % width) visit(n - 1); if (n % width < width - 1) visit(n + 1); visit(n - width); visit(n + width); }
      let left = width, top = height, right = 0, bottom = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (pixels.data[(y * width + x) * 4 + 3] > 40) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
      context.putImageData(pixels, 0, 0);
      const sprite = document.createElement('canvas'); sprite.width = Math.max(1, right - left + 1); sprite.height = Math.max(1, bottom - top + 1);
      sprite.getContext('2d')?.drawImage(cell, left, top, sprite.width, sprite.height, 0, 0, sprite.width, sprite.height);
      result.frames.push(sprite);
    }
  };
  atlas.src = url;
  return result;
}

export function drawSprite(ctx: CanvasRenderingContext2D, sprites: SpriteSet, index: number, x: number, feet: number, height: number, facing: number, nativeFacing = 1): boolean {
  const sprite = sprites.frames[index]; if (!sprite) return false;
  const width = height * sprite.width / sprite.height;
  ctx.save(); ctx.translate(x, feet); ctx.scale(facing === nativeFacing ? 1 : -1, 1);
  ctx.drawImage(sprite, -width / 2, -height, width, height); ctx.restore(); return true;
}

export function atmosphere(ctx: CanvasRenderingContext2D, frame: number, level: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 3; i++) {
    const x = 50 + i * 106 + Math.sin(frame / 240 + i) * 12;
    const ray = ctx.createLinearGradient(x, 0, x + 38, 185);
    ray.addColorStop(0, level === 2 ? '#ff752b18' : '#ffb36a16'); ray.addColorStop(1, '#ff632000');
    ctx.fillStyle = ray; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 9, 0); ctx.lineTo(x + 65, 185); ctx.lineTo(x + 17, 185); ctx.closePath(); ctx.fill();
  }
  for (let i = 0; i < 4; i++) {
    const x = (frame * 0.045 + i * 104) % 420 - 70;
    const fog = ctx.createRadialGradient(x, 162 - i * 8, 0, x, 162 - i * 8, 66);
    fog.addColorStop(0, '#b54b280e'); fog.addColorStop(1, '#b54b2800'); ctx.fillStyle = fog; ctx.fillRect(x - 66, 80, 132, 112);
  }
  ctx.restore();
}

// The animation atlas uses four columns: running poses above, wingbeats below.
export function loadAnimationSprites(url: string, options: { trim?: boolean; rowSplit?: number; chromaKey?: boolean; lightBackdrop?: boolean } = {}): SpriteSet {
  const result: SpriteSet = { frames: [] };
  const atlas = new Image();
  atlas.onload = () => {
    const width = Math.ceil(atlas.naturalWidth / 4), height = Math.ceil(atlas.naturalHeight / 2);
    const splitY = Math.round(atlas.naturalHeight * (options.rowSplit ?? 0.5));
    const cells: HTMLCanvasElement[] = [];
    const bounds = [0, 1].map(() => ({ left: width, top: height, right: 0, bottom: 0 }));
    for (let i = 0; i < 8; i++) {
      const left = Math.floor(i % 4 * atlas.naturalWidth / 4);
      const cellWidth = Math.floor((i % 4 + 1) * atlas.naturalWidth / 4) - left;
      const top = i < 4 ? 0 : splitY, cellHeight = i < 4 ? splitY : atlas.naturalHeight - splitY;
      const frame = document.createElement('canvas'); frame.width = cellWidth; frame.height = cellHeight;
      const context = frame.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(atlas, left, top, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
      const pixels = context.getImageData(0, 0, cellWidth, cellHeight);
      for (let p = 0; p < pixels.data.length; p += 4) {
        const r = pixels.data[p], g = pixels.data[p + 1], b = pixels.data[p + 2];
        if (options.lightBackdrop && Math.min(r, g, b) > 210 && Math.max(r, g, b) - Math.min(r, g, b) < 18) pixels.data[p + 3] = 0;
        if (options.chromaKey !== false && g > 85 && g > r * 1.35 && g > b * 1.35) pixels.data[p + 3] = 0;
      }
      const box = bounds[Math.floor(i / 4)];
      for (let y = 0; y < cellHeight; y++) for (let x = 0; x < cellWidth; x++) if (pixels.data[(y * cellWidth + x) * 4 + 3] > 40) {
        box.left = Math.min(box.left, x); box.right = Math.max(box.right, x);
        box.top = Math.min(box.top, y); box.bottom = Math.max(box.bottom, y);
      }
      context.putImageData(pixels, 0, 0); cells.push(frame);
    }
    if (options.trim === false) { result.frames.push(...cells); return; }
    // Shared row bounds keep feet and wingbeats stable between poses.
    cells.forEach((cell, i) => {
      const box = bounds[Math.floor(i / 4)];
      const frame = document.createElement('canvas');
      frame.width = Math.max(1, box.right - box.left + 1); frame.height = Math.max(1, box.bottom - box.top + 1);
      frame.getContext('2d')?.drawImage(cell, box.left, box.top, frame.width, frame.height, 0, 0, frame.width, frame.height);
      result.frames.push(frame);
    });
  };
  atlas.src = url;
  return result;
}
