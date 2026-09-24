/**
 * Client unit tests (pure modules): list ops, hash router round-trip,
 * sync-pill state machine, optimistic rollback. Run via `npm test`.
 */
import assert from 'node:assert/strict';
import { applyListOps } from '../src/client/listops.js';
import { parse, format } from '../src/client/router.js';
import * as store from '../src/client/store.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const rows = [
  { org_id: '3', business_name: 'Cedar', state: 'CO', lifecycle_status: 'ACTIVE_PROJECT', at_risk: false },
  { org_id: '1', business_name: 'alpha', state: 'CA', lifecycle_status: 'CLOSED_WON', at_risk: true },
  { org_id: '2', business_name: 'Beta', state: 'CO', lifecycle_status: 'ACTIVE_PROJECT', at_risk: false },
  { org_id: '4', business_name: 'Delta', state: '', lifecycle_status: 'ONBOARDED', at_risk: false },
];
const columns = [
  { key: 'org_id', sortVal: (r) => Number(r.org_id) },
  { key: 'business_name' },
  { key: 'state' },
  { key: 'lifecycle_status', groupOrder: ['CLOSED_WON', 'ONBOARDED', 'ACTIVE_PROJECT'] },
  { key: 'at_risk', text: (r) => (r.at_risk ? 'Yes' : 'No') },
];

test('filter contains / equals / not / empty / not_empty', () => {
  const f = (filters) => applyListOps(rows, { filters }, columns).rows.map((r) => r.org_id);
  assert.deepEqual(f([{ col: 'state', op: 'equals', val: 'co' }]).sort(), ['2', '3']);
  assert.deepEqual(f([{ col: 'business_name', op: 'contains', val: 'ta' }]).sort(), ['2', '4']);
  assert.deepEqual(f([{ col: 'state', op: 'not', val: 'CO' }]).sort(), ['1', '4']);
  assert.deepEqual(f([{ col: 'state', op: 'empty' }]), ['4']);
  assert.deepEqual(f([{ col: 'at_risk', op: 'equals', val: 'yes' }]), ['1']);
  assert.deepEqual(f([{ col: 'state', op: 'not_empty' }, { col: 'state', op: 'equals', val: 'CO' }]).sort(), ['2', '3']);
});

test('sort is case-insensitive, numeric-aware, empties last, asc/desc', () => {
  const s = (sort) => applyListOps(rows, { sort }, columns).rows.map((r) => r.business_name);
  assert.deepEqual(s({ col: 'business_name', dir: 'asc' }), ['alpha', 'Beta', 'Cedar', 'Delta']);
  assert.deepEqual(s({ col: 'business_name', dir: 'desc' }), ['Delta', 'Cedar', 'Beta', 'alpha']);
  assert.deepEqual(applyListOps(rows, { sort: { col: 'state', dir: 'asc' } }, columns).rows.map((r) => r.org_id).slice(-1), ['4']);
  assert.deepEqual(applyListOps(rows, { sort: { col: 'org_id', dir: 'asc' } }, columns).rows.map((r) => r.org_id), ['1', '2', '3', '4']);
});

test('group respects groupOrder and keeps sort within groups', () => {
  const g = applyListOps(rows, { sort: { col: 'business_name', dir: 'asc' }, group: 'lifecycle_status' }, columns);
  assert.equal(g.grouped, true);
  assert.deepEqual(g.groups.map((x) => x.key), ['CLOSED_WON', 'ONBOARDED', 'ACTIVE_PROJECT']);
  assert.deepEqual(g.groups[2].rows.map((r) => r.business_name), ['Beta', 'Cedar']);
  assert.equal(g.count, 4);
  assert.deepEqual(g.flat.map((r) => r.org_id), ['1', '4', '2', '3']);
});

test('list ops are idempotent and do not mutate input', () => {
  const st = { filters: [{ col: 'state', op: 'equals', val: 'CO' }], sort: { col: 'business_name', dir: 'desc' }, group: null };
  const before = JSON.stringify(rows);
  const a = applyListOps(rows, st, columns);
  const b = applyListOps(a.rows, st, columns);
  assert.deepEqual(a.rows, b.rows);
  assert.equal(JSON.stringify(rows), before);
});

test('view state survives a hash round-trip (filters/sort/group/hide + drawer)', () => {
  const list = JSON.stringify({ filters: [{ col: 'state', op: 'equals', val: 'C&O = "x"' }], sort: { col: 'state', dir: 'desc' }, group: 'lifecycle_status', hidden: ['dba'] });
  const route = { view: 'pros', id: '', tab: '', savedView: 'risk', list, drawer: { kind: 'pro', id: '749297', tab: 'notes' } };
  const back = parse('#' + format(route));
  assert.equal(back.view, 'pros');
  assert.equal(back.savedView, 'risk');
  assert.deepEqual(JSON.parse(back.list), JSON.parse(list));
  assert.deepEqual(back.drawer, { kind: 'pro', id: '749297', tab: 'notes' });
  const page = parse('#' + format({ view: 'project', id: 'PRJ-1-2025-SCORP', tab: 'stages' }));
  assert.deepEqual([page.view, page.id, page.tab, page.drawer], ['project', 'PRJ-1-2025-SCORP', 'stages', null]);
  assert.equal(parse('').view, 'home');
  assert.equal(parse('#/pros?drawer=bogus:1').drawer, null);
});

test('sync bus: idle → saving → idle, and error keeps a retry', () => {
  assert.equal(store.getState().sync.phase, 'idle');
  store.syncStart('task');
  assert.equal(store.getState().sync.phase, 'saving');
  assert.equal(store.getState().sync.label, 'task');
  store.syncStart('note');
  store.syncDone();
  assert.equal(store.getState().sync.phase, 'saving', 'still saving while another call is in flight');
  store.syncDone();
  assert.equal(store.getState().sync.phase, 'idle');
  let retried = false;
  store.syncStart('stage');
  store.syncFail('stage', () => { retried = true; });
  assert.equal(store.getState().sync.phase, 'error');
  store.getState().sync.retry();
  assert.equal(retried, true);
});

test('mutate: optimistic change rolls back + toasts on failure, sticks on success', async () => {
  globalThis.window = {};
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    const body = JSON.parse(init.body);
    const ok = body.action === 'good';
    return { json: async () => (ok ? { ok: true, data: { v: 2 } } : { ok: false, error: 'This pro was changed by someone else.', code: 'CONFLICT' }) };
  };
  store.setState({ flag: 1, toasts: [] });
  const opt = () => { const prev = store.getState().flag; store.setState({ flag: 99 }); return () => store.setState({ flag: prev }); };
  await assert.rejects(store.mutate({ label: 'x', what: 'x', action: 'bad', optimistic: opt }));
  assert.equal(store.getState().flag, 1, 'rolled back');
  assert.equal(store.getState().sync.phase, 'error');
  assert.match(store.getState().toasts[0].msg, /changed by someone else/);
  assert.equal(store.getState().toasts[0].action.label, 'Refresh');
  let applied = null;
  const data = await store.mutate({ label: 'y', action: 'good', optimistic: opt, apply: (d) => { applied = d; } });
  assert.equal(store.getState().flag, 99);
  assert.deepEqual(applied, { v: 2 });
  assert.equal(store.getState().sync.phase, 'idle');
  assert.equal(calls, 2);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log('  ✓ ' + t.name); } catch (e) { failed++; console.log('  ✗ ' + t.name + '\n    ' + String(e.stack || e).split('\n').slice(0, 5).join('\n    ')); }
}
console.log(`\n${tests.length - failed}/${tests.length} client tests passed`);
process.exit(failed ? 1 : 0);
