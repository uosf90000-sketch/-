import test from "node:test";
import assert from "node:assert/strict";
import { createNavigation } from "../lib/client/walk-navigation.ts";
import { designPreferences, mergeRoomDesign } from "../lib/design-scope.ts";
const bounds = { minX: 0, minY: 0, maxX: 10, maxY: 8 };
const wall = { entityId: 1, x1: 5, y1: 0, x2: 5, y2: 8, thickness: 0.2 };
const door = { wallEntityId: 1, kind: "door", position: 0.5, widthM: 1.2 };
const start = { x: 2, z: -4 },
  end = { x: 8, z: -4 };
test("a solid wall blocks walking and prevents a route through a disconnected room", () => {
  const nav = createNavigation([wall], [], [], bounds);
  assert.equal(nav.lineClear(start, end), false);
  assert.deepEqual(nav.route(start, end), []);
});
test("a real doorway admits a route but its neighboring wall remains solid", () => {
  const nav = createNavigation([wall], [door], [], bounds);
  const route = nav.route(start, end);
  assert.ok(route.length > 0);
  let prev = start;
  for (const p of route) {
    assert.ok(nav.lineClear(prev, p));
    prev = p;
  }
  assert.equal(nav.clear({ x: 5, z: -1 }), false);
  assert.equal(nav.clear({ x: 5, z: -4 }), true);
});
test("furniture and exterior boundaries obstruct manual movement", () => {
  const sofa = {
    planX: 500,
    planY: 500,
    widthM: 2,
    depthM: 1,
    rotationDeg: 0,
    category: "sofa",
  };
  const nav = createNavigation([], [], [sofa], bounds);
  assert.equal(nav.clear({ x: 5, z: -4 }), false);
  assert.equal(nav.clear({ x: -1, z: -2 }), false);
  const path = nav.route(start, end);
  assert.ok(path.length > 1);
  let prev = start;
  for (const p of path) {
    assert.ok(nav.lineClear(prev, p));
    prev = p;
  }
});
test("rotated furniture is accounted for and initial camera position can be moved to free space", () => {
  const nav = createNavigation(
    [],
    [],
    [
      {
        planX: 500,
        planY: 500,
        widthM: 3,
        depthM: 0.5,
        rotationDeg: 90,
        category: "table",
      },
    ],
    bounds,
  );
  assert.equal(nav.clear({ x: 5, z: -5 }), false);
  const p = nav.nearest({ x: 5, z: -4 });
  assert.ok(p && nav.clear(p));
});
const room = {
  name: "المجلس",
  polygon: [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 8 },
    { x: 0, y: 8 },
  ],
};
const analysis = {
  inferredRooms: [room],
  ifcPlan: { walls: [{ x1: 0, y1: 0, x2: 10, y2: 8 }] },
};
const left = { name: "new chair", room: "المجلس", planX: 200, planY: 500 };
const right = { name: "keep sofa", room: "الصالة", planX: 800, planY: 500 };
test("design style and selected room are validated without mutating the analysis", () => {
  const before = JSON.stringify(analysis);
  assert.equal(
    designPreferences({ style: "Japandi", roomIndex: 0 }, analysis).roomName,
    "المجلس",
  );
  assert.equal(
    designPreferences({ style: "unknown" }, analysis).style,
    "Saudi Contemporary",
  );
  assert.throws(() => designPreferences({ roomIndex: 6 }, analysis));
  assert.equal(JSON.stringify(analysis), before);
});
test("room design preserves other rooms and excludes generated elements outside the selected space", () => {
  const result = mergeRoomDesign(
    { items: [right], lighting: [], airConditioning: [] },
    {
      items: [left, { ...right, name: "wrong room item" }],
      lighting: [],
      airConditioning: [],
    },
    room,
    "المجلس",
    analysis,
  );
  assert.deepEqual(result.items, [right, left]);
});
test("a result without elements in the selected room is rejected before saving", () => {
  assert.throws(() =>
    mergeRoomDesign(
      { items: [right] },
      { items: [right] },
      room,
      "المجلس",
      analysis,
    ),
  );
});
