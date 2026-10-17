/**
 * Astra DB Document API client.
 *
 * The collection is addressed by one URL (the "endpoint" from the Astra UI):
 *   https://<db-id>-<region>.apps.astra.datastax.com/api/rest/v2/namespaces/burgers/collections/burger_info
 *
 * Everything below is plain HTTP — that is the whole point of the Document API:
 * JSON documents in, JSON documents out, no CQL and no fixed schema.
 */
const { randomUUID } = require('node:crypto');

const BASE_URL = (process.env.ASTRA_ENDPOINT || '').trim().replace(/\/+$/, '');
const TOKEN = (process.env.ASTRA_TOKEN || '').trim();

// The API falls back to an in-memory store when no endpoint is configured, so the
// UI can be developed without credentials. Same shapes, no behaviour differences.
const USE_MOCK = process.env.USE_MOCK === '1' || BASE_URL === '';

/* ------------------------------------------------------------------ mock store */

const seedDocs = [
  {
    name: "Bob's Burgers",
    description: 'Tasty burgers from a fictional TV restaurant',
    ingredients: ['beef patty', 'tomato', 'cucumber', 'lettuce', 'cheese'],
    visited: true,
    location: { address: '45 Lambda Drive', zip: 12345, website: 'https://www.bobsburgers.com' },
  },
  {
    name: 'The Smoking Bun',
    description: 'Smoked brisket, pickled onion, house sauce',
    ingredients: ['brisket', 'pickled onion', 'cheddar', 'brioche bun'],
    visited: false,
    location: { address: '12 Grill Street', zip: 44101, website: 'https://smokingbun.example' },
  },
  {
    name: 'Greenhouse Veggie',
    description: 'Chickpea and beetroot patty with herb yoghurt',
    ingredients: ['chickpea patty', 'beetroot', 'rocket', 'yoghurt'],
    visited: true,
    location: { address: '9 Market Square', zip: 90120, website: 'https://greenhouse.example' },
  },
  {
    name: 'Midnight Double',
    description: 'Two patties, no regrets — open until 4am',
    ingredients: ['beef patty', 'beef patty', 'bacon', 'american cheese', 'gherkin'],
    visited: false,
    location: { address: '3 Neon Alley', zip: 10001, website: 'https://midnightdouble.example' },
  },
];

const mock = new Map(seedDocs.map((doc) => [randomUUID(), doc]));

/* ------------------------------------------------------------------- transport */

function headers(extra = {}) {
  return {
    accept: 'application/json',
    'x-cassandra-token': TOKEN,
    ...extra,
  };
}

async function request(path = '', init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers: headers(init.headers) });
  const text = await res.text();

  if (!res.ok) {
    const err = new Error(`Astra Document API ${res.status}: ${text || res.statusText}`);
    err.status = res.status;
    throw err;
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// The v2 API returns { data: { <documentId>: { ...doc } }, pageState: null }.
// Normalise that (and the occasional array response) to an array of documents.
function toArray(payload) {
  const data = payload && payload.data !== undefined ? payload.data : payload;
  if (!data) return [];
  if (Array.isArray(data)) return data.map((doc) => ({ _id: doc._id ?? doc.id, ...doc }));
  return Object.entries(data).map(([id, doc]) => ({ _id: doc._id ?? id, ...doc }));
}

function unwrapOne(payload) {
  if (!payload) return null;
  if (payload.data && !Array.isArray(payload.data) && typeof payload.data === 'object') {
    // { data: { <id>: {...} } }
    const entries = Object.entries(payload.data);
    if (entries.length === 1 && typeof entries[0][1] === 'object') {
      return { _id: entries[0][1]._id ?? entries[0][0], ...entries[0][1] };
    }
  }
  return payload;
}

/* ------------------------------------------------------------------------ api */

async function list() {
  if (USE_MOCK) {
    return [...mock.entries()].map(([id, doc]) => ({ _id: id, ...doc }));
  }
  const payload = await request('?page-size=100');
  return toArray(payload);
}

async function get(id) {
  if (USE_MOCK) {
    const doc = mock.get(id);
    if (!doc) return null;
    return { _id: id, ...doc };
  }
  const payload = await request(`/${encodeURIComponent(id)}`);
  return unwrapOne(payload);
}

async function create(doc) {
  if (USE_MOCK) {
    const id = randomUUID();
    mock.set(id, doc);
    return { documentId: id };
  }
  const payload = await request('', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(doc),
  });
  return { documentId: payload.documentId || payload.insertedId || payload.id };
}

async function update(id, doc) {
  if (USE_MOCK) {
    if (!mock.has(id)) return null;
    mock.set(id, doc);
    return { _id: id, ...doc };
  }
  const payload = await request(`/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(doc),
  });
  return unwrapOne(payload);
}

async function remove(id) {
  if (USE_MOCK) {
    return mock.delete(id);
  }
  await request(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  seedDocs,
  isMock: () => USE_MOCK,
};
