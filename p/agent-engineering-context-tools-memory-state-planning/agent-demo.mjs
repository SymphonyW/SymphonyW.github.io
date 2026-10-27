// Runtime-mechanics demo; no model API, network, durable storage, or remote writes.
// Run with a modern Node.js: node agent-demo.mjs
import assert from 'node:assert/strict';

const documents = {
  a: { version: '1', text: 'Demo A: deployment and access-control notes.' },
  b: { version: '2', text: 'Demo B: deployment and maintenance notes.' },
  c: { version: '3', text: 'Demo C: access-control details need version verification.' },
};
const identity = { tenant: 'demo-team', user: 'reader', allowedDocs: ['a', 'b', 'c'] };
const memories = [
  { tenant: 'demo-team', user: 'reader', key: 'language', value: 'zh-CN' },
  { tenant: 'other-team', user: 'reader', key: 'language', value: 'private' },
];

function initialState() {
  return {
    runId: 'demo-1', revision: 0, status: 'running', iterations: 0,
    goal: 'Collect three demo documents and produce an evidence inventory.',
    constraints: ['No purchases', 'No external delivery'],
    evidence: [], report: null,
  };
}

function buildContext(state, actor, memoryStore) {
  const preferences = memoryStore.filter(m => m.tenant === actor.tenant && m.user === actor.user);
  return {
    goal: state.goal, constraints: [...state.constraints],
    progress: state.evidence.map(e => ({ id: e.id, version: e.version })),
    preferences,
  };
}

// Fixed policy stands in for model_decide. It does not perform research.
function decide(context) {
  const next = ['a', 'b', 'c'].find(id => !context.progress.some(e => e.id === id));
  return next
    ? { kind: 'tool', name: 'read_document', args: { document_id: next, max_chars: 200 } }
    : { kind: 'finish' };
}

function execute(action, actor) {
  if (action?.kind !== 'tool' || action.name !== 'read_document') throw new Error('Unknown tool');
  const args = action.args;
  if (!args || typeof args !== 'object' || Array.isArray(args)
    || Object.keys(args).some(k => !['document_id', 'max_chars'].includes(k))
    || typeof args.document_id !== 'string'
    || !Number.isInteger(args.max_chars) || args.max_chars < 1 || args.max_chars > 8000) {
    throw new Error('Invalid arguments');
  }
  if (!actor.allowedDocs.includes(args.document_id)) throw new Error('Permission denied');
  const doc = Object.hasOwn(documents, args.document_id) ? documents[args.document_id] : null;
  if (!doc) throw new Error('Document not found');
  return {
    id: args.document_id, version: doc.version,
    text: doc.text.slice(0, args.max_chars),
    truncated: doc.text.length > args.max_chars,
  };
}

function verifyEvidence(evidence) {
  return evidence.length === 3 && ['a', 'b', 'c'].every(id => evidence.some(e =>
    e.id === id && e.version === documents[id].version
    && e.text === documents[id].text && !e.truncated));
}

function step(state, actor, memoryStore, maxIterations = 6) {
  if (state.status !== 'running') return structuredClone(state);
  const next = structuredClone(state);
  if (next.iterations >= maxIterations) {
    next.status = 'budget_exhausted';
    next.revision++;
    return next;
  }
  next.iterations++;
  const action = decide(buildContext(next, actor, memoryStore));
  if (action.kind === 'tool') {
    next.evidence.push(execute(action, actor));
  } else if (action.kind === 'finish') {
    if (!verifyEvidence(next.evidence)) throw new Error('Incomplete evidence');
    next.report = '# Demo evidence inventory\n\n' + next.evidence.map(e =>
      `- [${e.id}@${e.version}] ${e.text}`).join('\n');
    assert.ok(next.report.includes('[c@3]'));
    next.status = 'completed';
  } else {
    throw new Error('Invalid action');
  }
  next.revision++;
  return next;
}

function run(state, maxIterations = 6) {
  while (state.status === 'running') state = step(state, identity, memories, maxIterations);
  return state;
}

const once = step(initialState(), identity, memories);
// JSON round-trip simulates a serializable checkpoint. This is NOT durable storage.
const restored = JSON.parse(JSON.stringify(once));
const resumed = run(restored);
assert.equal(once.evidence.length, 1); // Updating the next state did not mutate the snapshot.
assert.deepEqual(resumed, run(initialState())); // Resume matches uninterrupted execution.
assert.equal(resumed.status, 'completed');
assert.equal(new Set(resumed.evidence.map(e => e.id)).size, 3);
assert.equal(buildContext(once, identity, memories).preferences.length, 1);
assert.equal(buildContext(once, identity, []).preferences.length, 0);
assert.equal(run(initialState(), 1).status, 'budget_exhausted');
assert.equal(verifyEvidence(resumed.evidence.slice(1)), false);
assert.equal(verifyEvidence(resumed.evidence.map(e => ({ ...e, truncated: true }))), false);
assert.throws(() => execute({ kind: 'tool', name: 'read_document', args: {
  document_id: 'a', max_chars: 0,
} }, identity), /Invalid arguments/);
assert.throws(() => execute({ kind: 'tool', name: 'read_document', args: {
  document_id: 'a', max_chars: 200, user_id: 'admin',
} }, identity), /Invalid arguments/);
assert.throws(() => execute({ kind: 'tool', name: 'read_document', args: {
  document_id: 'a', max_chars: 200,
} }, { ...identity, allowedDocs: [] }), /Permission denied/);
console.log('Checks passed: scoped memory, validation, permissions, snapshot resume, budget, evidence.');
console.log(resumed.report);
