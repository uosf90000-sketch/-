// Design preferences are separate from the plan reading pipeline.
export const SUPPORTED_STYLES = [
  "Saudi Contemporary",
  "Warm Minimal",
  "Modern",
  "Luxury",
  "Japandi",
] as const;
export function designPreferences(input: any, analysis: any) {
  const style =
    typeof input.style === "string" &&
    SUPPORTED_STYLES.includes(input.style as any)
      ? input.style
      : "Saudi Contemporary";
  const rooms = Array.isArray(analysis?.inferredRooms)
    ? analysis.inferredRooms
    : [];
  if (
    input.roomIndex !== undefined &&
    (!Number.isInteger(input.roomIndex) ||
      input.roomIndex < 0 ||
      input.roomIndex >= rooms.length)
  )
    throw new Error("الغرفة المحددة غير موجودة.");
  const room = input.roomIndex === undefined ? null : rooms[input.roomIndex];
  const roomName = room ? room.name || "غرفة " + (input.roomIndex + 1) : null;
  return { style, room, roomName };
}
function inside(x: number, y: number, polygon: any[]) {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.y > y !== b.y > y &&
      x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
    )
      yes = !yes;
  }
  return yes;
}
export function mergeRoomDesign(
  previous: any,
  generated: any,
  room: any,
  roomName: string,
  analysis: any,
) {
  const walls = analysis?.ifcPlan?.walls || [];
  const xs = walls.flatMap((w: any) => [Number(w.x1), Number(w.x2)]),
    ys = walls.flatMap((w: any) => [Number(w.y1), Number(w.y2)]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const belongs = (item: any) => {
    if (!Number.isFinite(item.planX) || !Number.isFinite(item.planY))
      return item.room === roomName;
    return inside(
      minX + (item.planX / 1000) * (maxX - minX),
      maxY - (item.planY / 1000) * (maxY - minY),
      room.polygon || [],
    );
  };
  const merged = { ...previous, ...generated };
  for (const key of ["items", "lighting", "airConditioning"]) {
    const incoming = (generated[key] || [])
      .filter(belongs)
      .map((item: any) => ({ ...item, room: roomName }));
    merged[key] = [
      ...(previous?.[key] || []).filter((item: any) => !belongs(item)),
      ...incoming,
    ];
  }
  if (
    !["items", "lighting", "airConditioning"].some((key) =>
      (generated[key] || []).some(belongs),
    )
  )
    throw new Error("لم يصل تصميم مناسب لمساحة الغرفة. حاول مرة أخرى.");
  merged.roomFinishes = [
    ...(previous?.roomFinishes || []).filter((f: any) => f.room !== roomName),
    ...(generated.roomFinishes || []).filter((f: any) => f.room === roomName),
  ];
  return merged;
}
