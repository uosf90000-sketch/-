import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { applyPlanReview, emptyReview, editReview, mergeOpenings, openingKey, openingHostAt } from "../lib/plan-review.ts";
import { preparePlanImage, restoreRoomCoordinates } from "../lib/server/plan-image.ts";

const wall = { entityId: 1, x1: 0, y1: 0, x2: 10, y2: 0, thickness: .2 };
const side = { entityId: 2, x1: 10, y1: 0, x2: 10, y2: 10 };
const analysis = { ifcPlan: { walls: [wall, side], openings: [] }, inferredRooms: [{ id: "living", center: { x: 5, y: 5 }, name: "غرفة" }] };
const door = { kind: "door", wallEntityId: 1, position: .5, widthM: 1 };
test("counts and 3D use the same union without double-counting provider and raster doors", () => {
  const merged = mergeOpenings([wall], [door], [{ ...door, position: .51 }, { ...door, position: .8 }]);
  assert.equal(merged.length, 2);
});
test("confirmed windows override overlapping false door proposals", () => {
  const review = editReview(emptyReview, { type: "opening", opening: { ...door, kind: "window" } }, analysis);
  const result = applyPlanReview(analysis, review);
  assert.equal(mergeOpenings([wall], result.ifcPlan.openings, [door])[0].kind, "window");
});
test("removed detections stay removed when raster detection runs again", () => {
  const review = editReview(emptyReview, { type: "remove", key: openingKey(door) }, analysis);
  assert.equal(mergeOpenings([wall], [], [door], review.removed).length, 0);
});
test("manual room names persist, take priority over OCR and preserve original geometry", () => {
  const review = editReview(emptyReview, { type: "room", roomId: "living", name: "  مجلس النساء  " }, analysis);
  const result = applyPlanReview(analysis, JSON.parse(JSON.stringify(review)));
  assert.equal(result.inferredRooms[0].name, "مجلس النساء");
  assert.deepEqual(result.inferredRooms[0].center, analysis.inferredRooms[0].center);
  assert.equal(analysis.inferredRooms[0].name, "غرفة");
});
test("invalid hosts, oversized openings and unknown rooms are rejected", () => {
  for (const opening of [{ ...door, wallEntityId: 100 }, { ...door, widthM: 50 }, { ...door, position: 0 }, { ...door, widthM: NaN }]) {
    assert.throws(() => editReview(emptyReview, { type: "opening", opening }, analysis));
  }
  assert.throws(() => editReview(emptyReview, { type: "room", roomId: "missing", name: "مطبخ" }, analysis));
});
test("a doorway in a gap gets its own host instead of cutting a neighboring wall", () => {
  const walls = [{ ...wall, x2: 4 }, { ...wall, entityId: 2, x1: 5 }];
  const host = openingHostAt(walls, 4.5, 0);
  assert.equal(host.wall.source, "user-confirmed-gap");
  assert.equal(host.wall.x1, 4); assert.equal(host.wall.x2, 5);
  const base = { ifcPlan: { walls, openings: [] } };
  const review = editReview(emptyReview, { type: "opening", opening: { ...door, wallEntityId: host.wall.entityId, point: { x: 4.5, y: 0 } } }, base);
  const result = applyPlanReview(base, review);
  assert.equal(result.ifcPlan.walls.length, 3);
  assert.equal(result.ifcPlan.openings.length, 1);
  const removed = editReview(review, { type: "remove", key: openingKey(review.openings[0]) }, base);
  assert.equal(applyPlanReview(base, removed).ifcPlan.walls.length, 2);
});
test("gaps wider than three meters or filled by a real wall are not invented", () => {
  const walls = [{ ...wall, x2: 3 }, { ...wall, entityId: 2, x1: 7 }];
  assert.notEqual(openingHostAt(walls, 5, 0).wall.source, "user-confirmed-gap");
  const filled = [{ ...wall, x2: 4 }, { ...wall, entityId: 2, x1: 5 }, { ...wall, entityId: 3, x1: 4, x2: 5 }];
  assert.equal(openingHostAt(filled, 4.5, 0).wall.entityId, 3);
});
test("OCR names map from image coordinates to the matching room only", () => {
  const names = { alignment: { left: 0, top: 0, width: 1, height: 1 }, rooms: [{ name: "الصالة", confidence: .9, bbox: { x: 400, y: 400, width: 200, height: 200 } }] };
  assert.equal(applyPlanReview(analysis, emptyReview, names).inferredRooms[0].name, "الصالة");
  names.rooms[0].confidence = .3;
  assert.equal(applyPlanReview(analysis, emptyReview, names).inferredRooms[0].name, "غرفة");
});
test("phone chrome is cropped without shifting labels on the original image", async () => {
  const page = await sharp({ create: { width: 400, height: 600, channels: 3, background: "white" } }).png().toBuffer();
  const screenshot = await sharp({ create: { width: 400, height: 1000, channels: 3, background: "black" } }).composite([{ input: page, top: 200, left: 0 }]).png().toBuffer();
  const prepared = await preparePlanImage(screenshot);
  assert.ok(Math.abs(prepared.crop.top - .2) < .01);
  assert.ok(Math.abs(prepared.crop.height - .6) < .02);
  const [room] = restoreRoomCoordinates([{ bbox: { x: 100, y: 500, width: 100, height: 100 } }], prepared.crop);
  assert.ok(Math.abs(room.bbox.y - 500) < 4);
  const plain = await preparePlanImage(page);
  assert.deepEqual(plain.crop, { left: 0, top: 0, width: 1, height: 1 });
});

test("review endpoint persists corrections and rejects path traversal", async () => {
  const { mkdtemp, mkdir, readFile, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { default: ts } = await import("typescript");
  const root = await mkdtemp(tmpdir() + "/bayti-review-test-");
  const old = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  process.env.RAILWAY_VOLUME_MOUNT_PATH = root;
  const id = "11111111-1111-4111-8111-111111111111";
  try {
    await mkdir(root + "/uploads/" + id, { recursive: true });
    await writeFile(root + "/uploads/" + id + "/analysis.json", JSON.stringify(analysis));
    const source = (await readFile(new URL("../app/api/uploads/[id]/review/route.ts", import.meta.url), "utf8")).replace("@/lib/plan-review", new URL("../lib/plan-review.ts", import.meta.url).href);
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    const route = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
    const context = { params: Promise.resolve({ id }) };
    const response = await route.POST(new Request("http://localhost/review", { method: "POST", body: JSON.stringify({ type: "room", roomId: "living", name: "مجلس" }) }), context);
    assert.equal(response.status, 200);
    const persisted = await (await route.GET(new Request("http://localhost/review"), context)).json();
    assert.equal(persisted.review.roomNames.living, "مجلس");
    assert.equal((await route.GET(new Request("http://localhost/review"), { params: Promise.resolve({ id: "../../etc" }) })).status, 400);
  } finally {
    if (old === undefined) delete process.env.RAILWAY_VOLUME_MOUNT_PATH; else process.env.RAILWAY_VOLUME_MOUNT_PATH = old;
    await rm(root, { recursive: true, force: true });
  }
});
