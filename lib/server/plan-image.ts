import sharp from "sharp";

// Remove phone/gallery chrome only when a broad light page is surrounded by dark rows.
// Keep original coordinates so returned labels still align with the uploaded image.
export async function preparePlanImage(bytes: Buffer) {
  const original = await sharp(bytes).rotate().toBuffer();
  const meta = await sharp(original).metadata();
  const width = meta.width!, height = meta.height!;
  const { data, info } = await sharp(original).resize({ width: 320, withoutEnlargement: true }).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
  const rows: number[] = [];
  for (let y = 0; y < info.height; y++) {
    let light = 0;
    for (let x = 0; x < info.width; x++) if (data[y * info.width + x] > 205) light++;
    rows.push(light / info.width);
  }
  const pageRows = rows.map((v, i) => v > .55 ? i : -1).filter(i => i >= 0);
  const bestStart = pageRows[0] || 0;
  const bestLength = pageRows.length ? pageRows[pageRows.length - 1] - bestStart + 1 : 0;
  const hasDarkChrome = rows.slice(0, Math.max(1, Math.floor(rows.length * .08))).every(v => v < .2);
  const crop = hasDarkChrome && bestLength > info.height * .35 && pageRows.length / bestLength > .75;
  const top = crop ? Math.max(0, Math.floor(bestStart / info.height * height) - 3) : 0;
  const bottom = crop ? Math.min(height, Math.ceil((bestStart + bestLength) / info.height * height) + 3) : height;
  const buffer = await sharp(original).extract({ left: 0, top, width, height: bottom - top }).resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  return { buffer, crop: { left: 0, top: top / height, width: 1, height: (bottom - top) / height } };
}

export function restoreRoomCoordinates(rooms: any[], crop: { left: number; top: number; width: number; height: number }) {
  return rooms.map(room => ({ ...room, bbox: {
    x: crop.left * 1000 + room.bbox.x * crop.width,
    y: crop.top * 1000 + room.bbox.y * crop.height,
    width: room.bbox.width * crop.width,
    height: room.bbox.height * crop.height,
  } }));
}
