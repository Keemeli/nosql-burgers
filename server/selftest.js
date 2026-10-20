/**
 * Verifies the Data API client without credentials: stubs `fetch`, runs every
 * operation, and asserts the URL, method, headers and JSON command that each one
 * sends. Run with `npm test` (or `node server/selftest.js`).
 */
process.env.ASTRA_API_ENDPOINT = 'https://example-1-us-east-2.apps.astra.datastax.com';
process.env.ASTRA_KEYSPACE = 'burgers';
process.env.ASTRA_COLLECTION = 'burger_info';
process.env.ASTRA_TOKEN = 'AstraCS:test-token';
delete process.env.USE_MOCK;

const calls = [];

global.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  calls.push({ url, init, body });

  const reply = (payload) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify(payload),
  });

  if (body.find) return reply({ data: { documents: [{ _id: 'id-1', name: 'Bob\'s Burgers' }] } });
  if (body.findOne) return reply({ data: { document: { _id: 'id-1', name: 'Bob\'s Burgers' } } });
  if (body.insertOne) return reply({ status: { insertedIds: ['new-id'] } });
  if (body.updateOne) return reply({ status: { matchedCount: 1, modifiedCount: 1 } });
  if (body.deleteOne) return reply({ status: { deletedCount: 1 } });
  if (body.createCollection) return reply({ status: { ok: 1 } });
  throw new Error(`unexpected command: ${JSON.stringify(body)}`);
};

const burgers = require('./astra');

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
}

(async () => {
  const docs = await burgers.list();
  const create = await burgers.create({ name: 'X' });
  const one = await burgers.get('id-1');
  const updated = await burgers.update('id-1', { name: 'Y' });
  const removed = await burgers.remove('id-1');
  const collection = await burgers.ensureCollection();

  const EXPECTED_URL = 'https://example-1-us-east-2.apps.astra.datastax.com/api/json/v1/burgers/burger_info';

  // Look up requests by the command they carry (update issues two requests).
  const byCommand = (key, nth = 0) => calls.filter((c) => c.body[key] !== undefined)[nth];

  check('endpoint URL', calls[0].url, EXPECTED_URL);
  check('every request is a POST', calls.map((c) => c.init.method), calls.map(() => 'POST'));
  check('Token header sent', calls[0].init.headers.Token, 'AstraCS:test-token');
  check('Content-Type header sent', calls[0].init.headers['Content-Type'], 'application/json');

  check('list -> find command', byCommand('find').body, {
    find: { filter: {}, options: { limit: 100, skip: 0 } },
  });
  check('list returns documents array', docs, [{ _id: 'id-1', name: "Bob's Burgers" }]);
  check('create -> insertOne command', byCommand('insertOne').body, { insertOne: { document: { name: 'X' } } });
  check('create returns the new id', create, { documentId: 'new-id' });
  check('get -> findOne command', byCommand('findOne').body, { findOne: { filter: { _id: 'id-1' } } });
  check('get returns the document', one, { _id: 'id-1', name: "Bob's Burgers" });
  check('update -> updateOne command', byCommand('updateOne').body, {
    updateOne: { filter: { _id: 'id-1' }, update: { $set: { name: 'Y' } } },
  });
  check('update then re-reads the document', [byCommand('updateOne'), byCommand('findOne', 1)].map((c) => Object.keys(c.body)[0]), [
    'updateOne',
    'findOne',
  ]);
  check('update returns the document', updated, { _id: 'id-1', name: "Bob's Burgers" });
  check('delete -> deleteOne command', byCommand('deleteOne').body, { deleteOne: { filter: { _id: 'id-1' } } });
  check('delete reports success', removed, true);
  check('ensureCollection -> createCollection command', byCommand('createCollection').body, {
    createCollection: { name: 'burger_info' },
  });
  check('ensureCollection reports created', collection.created, true);
  check('seven requests in total', calls.length, 7);

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
})();
