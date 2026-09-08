import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { loadTs } from './helpers/load-ts.mjs';
const { TectlyClient, tectlyConfig } = await loadTs('lib/server/tectly/client.ts');
const { runTectlyStep, publicTectlyState } = await loadTs('lib/server/tectly/flow.ts');
const { normalizeTectlyResult, imagePoint, worldPoint } = await loadTs('lib/tectly/geometry.ts');
const { openingProposal, adoptTectlyElement } = await loadTs('lib/tectly/adopt.ts');
const { emptyReview, applyPlanReview } = await loadTs('lib/plan-review.ts');
const { withFileLock } = await loadTs('lib/server/json-store.ts');
const section = { left: .1, top: .2, width: .8, height: .6 };
const plan = { id: 'plan', floorId: 'floor', pageSection: section, wallProcessingStatus: 'Positive', roomProcessingStatus: 'Positive', wallOpeningProcessingStatus: 'Positive', horizontalScaleProcessingStatus: 'Negative', postProcessingStatus: 'Positive' };
const rawOpenings = [
  { id: 'door', details: { type: 'a-new-provider-label', hinge: [.4, 1], closed: [.5, 1], open: [.4, .9] } },
  { id: 'window', details: { type: 'anything', from: [1, .4], to: [1, .5] } },
  { id: 'sliding', details: { type: 'sliding', closed: [0, .4], open: [0, .5] } },
];
const rooms = [{ id: 'living', caption: 'المجلس', type: 'LivingRoom', boundary: [[0,0],[1,0],[1,1],[0,1]] }];
const normalized = normalizeTectlyResult(plan, 0, {}, [], rooms, rawOpenings);
const walls = [{ entityId: 1, x1: 0, y1: 0, x2: 10, y2: 0, thickness: .2 }, { entityId: 2, x1: 10, y1: 0, x2: 10, y2: 10, thickness: .2 }, { entityId: 3, x1: 0, y1: 0, x2: 0, y2: 10, thickness: .2 }];
const analysis = { ifcPlan: { walls, openings: [] }, inferredRooms: [{ id: 'room-1', center: { x: 5, y: 5 }, name: 'غرفة' }] };
const env = { TECTLY_CLIENT_ID: 'test-client', TECTLY_CLIENT_SECRET: 'test-secret' };
const json = value => Response.json(value);

test('credential names match the UI setup; aliases do not mix incomplete pairs; disable blocks use', () => {
  assert.ok(tectlyConfig(env).configured);
  assert.ok(tectlyConfig({ TECTLY_API_KEY: 'a', TECTLY_API_SECRET: 'b' }).configured);
  assert.equal(tectlyConfig({ TECTLY_CLIENT_ID: 'a', TECTLY_API_SECRET: 'b' }).configured, false);
  assert.equal(tectlyConfig({ ...env, TECTLY_DISABLED: 'true' }).configured, false);
  assert.equal(tectlyConfig({ ...env, TECTLY_API_BASE_URL: 'https://unrelated.example/api/v1' }).configured, false);
});
test('Basic is used only for token exchange, then Bearer; simultaneous authentication is shared', async () => {
  let calls = 0;
  const client = new TectlyClient(tectlyConfig(env), async (url, init) => {
    calls++;
    if (url.endsWith('/issue-authentication-token')) {
      assert.equal(init.headers.Authorization, 'Basic ' + Buffer.from('test-client:test-secret').toString('base64'));
      return json({ token: 'test-token', expiryDate: '2099-01-01T00:00:00Z' });
    }
    assert.equal(init.headers.Authorization, 'Bearer test-token');
    assert.equal(init.redirect, 'error');
    return json({ id: 'project' });
  });
  await Promise.all([client.authenticate(), client.authenticate()]);
  await client.request('/projects/project');
  assert.equal(calls, 2);
});
test('provider error text cannot expose credentials; failed writes are not retried', async () => {
  let writes = 0;
  const client = new TectlyClient(tectlyConfig(env), async url => {
    if (url.endsWith('/issue-authentication-token')) return json({ token: 'test-token' });
    writes++;
    return new Response('test-secret Bearer test-token', { status: 401 });
  });
  await assert.rejects(client.createProject('id', 'title'), e => !e.message.includes('test-secret') && !e.message.includes('test-token'));
  assert.equal(writes, 1);
});
test('document upload uses the documented multipart field', async () => {
  const client = new TectlyClient(tectlyConfig(env), async (url, init) => {
    if (url.endsWith('/issue-authentication-token')) return json({ token: 'test-token' });
    assert.ok(url.endsWith('/projects/project/documents'));
    assert.equal(init.body.get('document').name, 'plan.png');
    assert.equal(new Headers(init.headers).has('content-type'), false);
    return json({ id: 'doc' });
  });
  await client.addDocument('project', Buffer.from('test'), 'plan.png', 'image/png');
});
test('normalization identifies openings by shape and strips remote image URLs', () => {
  const result = normalizeTectlyResult({ ...plan, images: [{ url: 'private-url' }] }, 0, {}, [], rooms, rawOpenings);
  assert.deepEqual(result.openings.map(o => o.kind), ['door', 'window', 'door']);
  assert.equal(result.horizontalScale, null);
  assert.ok(result.warnings.length);
  assert.equal(JSON.stringify(result).includes('private-url'), false);
  assert.throws(() => normalizeTectlyResult({ ...plan, pageSection: { ...section, width: 2 } }, 0, {}, [], [], []));
});
test('plan coordinates compose through pageSection and invert image Y into BIMy meters', () => {
  const p = imagePoint([.5, .5], section);
  assert.ok(Math.abs(p[0] - .5) < 1e-8 && Math.abs(p[1] - .5) < 1e-8);
  const w = worldPoint([.5, .25], section, section, walls);
  assert.ok(Math.abs(w.x - 5) < 1e-8 && Math.abs(w.y - 7.5) < 1e-8);
});
test('matching openings can be adopted and appear in the effective 3D analysis', () => {
  const proposal = openingProposal(normalized, 'door', section, analysis, emptyReview);
  assert.ok(Math.abs(proposal.widthM - 1) < 1e-8);
  assert.equal(proposal.wallEntityId, 1);
  const review = adoptTectlyElement(normalized, { kind: 'opening', id: 'door' }, section, analysis, emptyReview);
  assert.equal(applyPlanReview(analysis, review).ifcPlan.openings.length, 1);
  assert.equal(analysis.ifcPlan.openings.length, 0);
});
test('rotated and distant opening suggestions cannot be cut into the nearest wall', () => {
  const wrong = structuredClone(normalized);
  wrong.openings[0].from = [.4, .5]; wrong.openings[0].to = [.5, .5];
  assert.throws(() => openingProposal(wrong, 'door', section, analysis, emptyReview));
  wrong.openings[0].from = [.4, 1]; wrong.openings[0].to = [.5, .9];
  assert.throws(() => openingProposal(wrong, 'door', section, analysis, emptyReview));
});
test('room naming requires exactly one matching existing room', () => {
  const review = adoptTectlyElement(normalized, { kind: 'room', id: 'living' }, section, analysis, emptyReview);
  assert.equal(review.roomNames['room-1'], 'المجلس');
  const ambiguous = { ...analysis, inferredRooms: [...analysis.inferredRooms, { id: 'room-2', center: { x: 4, y: 4 } }] };
  assert.throws(() => adoptTectlyElement(normalized, { kind: 'room', id: 'living' }, section, ambiguous, emptyReview));
});
async function fixture(fn) {
  const dir = await mkdtemp(tmpdir() + '/bayti-tectly-');
  await writeFile(dir + '/meta.json', JSON.stringify({ id: 'upload', extension: 'png', storedName: 'plan.png', name: 'plan.png' }));
  await writeFile(dir + '/plan.png', 'fixture');
  try { await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}
function fakeReader(options = {}) {
  const counts = { uploads: 0, projects: 0 };
  const reader = {
    authenticate: async () => {},
    createProject: async () => { counts.projects++; return { id: 'project' }; },
    addDocument: async () => { counts.uploads++; if (options.lostReply) throw new Error('connection reset'); return { id: 'doc' }; },
    request: async path => {
      if (path === '/projects/project') return { documents: [{ id: 'doc' }] };
      if (path === '/documents/doc') return { pageRenderingStatus: 'Positive', documentPages: [{ id: 'page', pageNumber: 0 }] };
      if (path === '/document-pages/page') return { planDetectionStatus: 'Positive', plans: [{ id: 'plan' }] };
      if (path === '/plans/plan') return { ...plan, ...(options.pending ? { wallOpeningProcessingStatus: 'Pending' } : {}) };
      if (path === '/floors/floor') return { id: 'floor' };
      if (path.endsWith('/walls')) return [];
      if (path.endsWith('/rooms')) return rooms;
      if (path.endsWith('/wall-openings')) return rawOpenings;
      throw new Error('unexpected ' + path);
    }
  };
  return { reader, counts };
}
test('starting requires usage confirmation and a saved upload prevents subsequent charges', async () => fixture(async dir => {
  const { reader, counts } = fakeReader();
  await assert.rejects(runTectlyStep(dir, 'start', false, reader));
  assert.equal(counts.uploads, 0);
  await runTectlyStep(dir, 'start', true, reader);
  let result;
  for (let i = 0; i < 4; i++) result = await runTectlyStep(dir, 'start', true, reader);
  assert.equal(counts.uploads, 1); assert.equal(counts.projects, 1);
  assert.equal(result.stage, 'partial'); assert.equal(result.results.length, 1);
  assert.equal(publicTectlyState(result).documentId, undefined);
}));
test('a lost upload reply is recovered through project documents, never by reuploading', async () => fixture(async dir => {
  const { reader, counts } = fakeReader({ lostReply: true });
  const uncertain = await runTectlyStep(dir, 'start', true, reader);
  assert.equal(uncertain.stage, 'uncertain');
  for (let i = 0; i < 4; i++) await runTectlyStep(dir, 'poll', false, reader);
  assert.equal(counts.uploads, 1);
  assert.equal(JSON.parse(await readFile(dir + '/tectly-state.json', 'utf8')).documentId, 'doc');
}));
test('pending opening processing cannot be marked ready prematurely', async () => fixture(async dir => {
  const { reader } = fakeReader({ pending: true });
  await runTectlyStep(dir, 'start', true, reader);
  for (let i = 0; i < 3; i++) await runTectlyStep(dir, 'poll', false, reader);
  const state = JSON.parse(await readFile(dir + '/tectly-state.json', 'utf8'));
  assert.equal(state.stage, 'processing'); assert.equal(state.results.length, 0);
}));
test('concurrent starts cannot acquire the same upload lock', async () => fixture(async dir => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let entered;
  const signal = new Promise(resolve => { entered = resolve; });
  const first = withFileLock(dir + '/state', async () => { entered(); await gate; });
  await signal;
  await assert.rejects(withFileLock(dir + '/state', async () => {}));
  release(); await first;
  await withFileLock(dir + '/state', async () => {});
}));

test('adoption endpoint requires alignment confirmation, verifies original bytes and persists the correction', async () => fixture(async root => {
  const { createHash } = await import('node:crypto');
  const id = '11111111-1111-4111-8111-111111111111';
  const dir = root + '/uploads/' + id;
  await mkdir(dir, { recursive: true });
  await writeFile(dir + '/meta.json', JSON.stringify({ extension: 'png', storedName: 'plan.png' }));
  await writeFile(dir + '/plan.png', 'fixture');
  await writeFile(dir + '/analysis.json', JSON.stringify(analysis));
  await writeFile(dir + '/tectly-state.json', JSON.stringify({ stage: 'ready', projectId: 'private-project', sourceHash: createHash('sha256').update('fixture').digest('hex'), plans: [], results: [normalized] }));
  const previous = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  process.env.RAILWAY_VOLUME_MOUNT_PATH = root;
  try {
    const route = await loadTs('app/api/uploads/[id]/tectly/route.ts');
    const context = { params: Promise.resolve({ id }) };
    const payload = { action: 'adopt', planId: normalized.id, element: { kind: 'opening', id: 'door' }, alignment: section, alignmentConfirmed: false };
    const request = () => new Request('http://localhost/tectly', { method: 'POST', body: JSON.stringify(payload) });
    assert.equal((await route.POST(request(), context)).status, 409);
    payload.alignmentConfirmed = true;
    const adopted = await route.POST(request(), context);
    assert.equal(adopted.status, 200);
    const saved = JSON.parse(await readFile(dir + '/review.json', 'utf8'));
    assert.equal(saved.openings.length, 1);
    const returned = await (await route.GET(new Request('http://localhost/tectly'), context)).json();
    assert.equal(JSON.stringify(returned).includes('private-project'), false);
    payload.action = 'fuse';
    const fused = await (await route.POST(request(), context)).json();
    assert.equal(fused.ok, true);
    assert.ok(fused.report.added > 0);
    assert.deepEqual(JSON.parse(await readFile(dir + '/review.json', 'utf8')), fused.review);
    const repeated = await (await route.POST(request(), context)).json();
    assert.equal(repeated.report.added, 0);
    await writeFile(dir + '/plan.png', 'different-plan');
    assert.equal((await route.POST(request(), context)).status, 409);
  } finally {
    if (previous === undefined) delete process.env.RAILWAY_VOLUME_MOUNT_PATH; else process.env.RAILWAY_VOLUME_MOUNT_PATH = previous;
  }
}));
