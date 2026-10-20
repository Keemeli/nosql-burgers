/**
 * Astra DB Data API client (collections).
 *
 * Astra DB Serverless databases use the *Data API*, not the legacy Document API
 * from older tutorials. Two differences matter:
 *
 *   1. Endpoint: https://<db-id>-<region>.apps.astra.datastax.com/api/json/v1/<keyspace>/<collection>
 *      (the legacy one was .../api/rest/v2/namespaces/<keyspace>/collections/<collection>)
 *   2. Every request is a POST with a JSON *command* body, authenticated with a
 *      `Token:` header (legacy used `x-cassandra-token`).
 *
 *   {"find":      {"filter": {}}                   }  ->  data.documents[]
 *   {"findOne":   {"filter": {"_id": "..."}}       }  ->  data.document
 *   {"insertOne": {"document": {...}}              }  ->  status.insertedIds[]
 *   {"updateOne": {"filter": ..., "update": {...}} }  ->  status.matchedCount
 *   {"deleteOne": {"filter": {"_id": "..."}}       }  ->  status.deletedCount
 *
 * Reference: https://docs.datastax.com/en/astra-db-serverless/api-reference/dataapiclient.html
 */
const { randomUUID } = require('node:crypto');

const API_ENDPOINT = (process.env.ASTRA_API_ENDPOINT || '').trim().replace(/\/+$/, '');
const KEYSPACE = (process.env.ASTRA_KEYSPACE || 'burgers').trim();
const COLLECTION = (process.env.ASTRA_COLLECTION || 'burger_info').trim();
const TOKEN = (process.env.ASTRA_TOKEN || '').trim();

const COLLECTION_URL = `${API_ENDPOINT}/api/json/v1/${KEYSPACE}/${COLLECTION}`;

// Falls back to an in-memory store when no endpoint is configured, so the UI can
// be developed without credentials. Same shapes, no behaviour differences.
const USE_MOCK = process.env.USE_MOCK === '1' || API_ENDPOINT === '';

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
    description: 'Two patties, no regrets, open until 4am',
    ingredients: ['beef patty', 'beef patty', 'bacon', 'american cheese', 'gherkin'],
    visited: false,
    location: { address: '3 Neon Alley', zip: 10001, website: 'https://midnightdouble.example' },
  },
];

const mock = new Map(seedDocs.map((doc) => [randomUUID(), doc]));

/* ------------------------------------------------------------------- transport */

// Runs one Data API command against the collection and returns the parsed body.
async function command(payload) {
  const res = await fetch(COLLECTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Token: TOKEN,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  // The Data API reports command-level failures with HTTP 200 and an `errors`
  // array, so an explicit check is required or the failure looks like "no data".
  if (res.ok && Array.isArray(body.errors) && body.errors.length > 0) {
    const first = body.errors[0];
    const err = new Error(`Data API ${first.errorCode || 'error'}: ${first.message || first.title || 'unknown'}`);
    err.status = res.status;
    err.errors = body.errors;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(`Data API ${res.status}: ${text || res.statusText}`);
    err.status = res.status;
    throw err;
  }

  return body;
}

// Page size for `find`. Non-vector finds are paginated, so the collection is read
// in pages using the `pageState` the API returns.
const PAGE_SIZE = 100;

/* ------------------------------------------------------------------------ api */

async function list() {
  if (USE_MOCK) {
    return [...mock.entries()].map(([id, doc]) => ({ _id: id, ...doc }));
  }

  const documents = [];
  let pageState = null;
  do {
    const options = { limit: PAGE_SIZE };
    if (pageState) options.pageState = pageState;
    const body = await command({ find: { filter: {}, options } });
    documents.push(...(body?.data?.documents ?? []));
    pageState = body?.data?.nextPageState ?? null;
  } while (pageState);
  return documents;
}

async function get(id) {
  if (USE_MOCK) {
    const doc = mock.get(id);
    return doc ? { _id: id, ...doc } : null;
  }
  const body = await command({ findOne: { filter: { _id: id } } });
  return body?.data?.document ?? null;
}

async function create(doc) {
  if (USE_MOCK) {
    const id = randomUUID();
    mock.set(id, doc);
    return { documentId: id };
  }
  const body = await command({ insertOne: { document: doc } });
  return { documentId: body?.status?.insertedIds?.[0] ?? null };
}

async function update(id, doc) {
  if (USE_MOCK) {
    if (!mock.has(id)) return null;
    mock.set(id, doc);
    return { _id: id, ...doc };
  }
  const body = await command({ updateOne: { filter: { _id: id }, update: { $set: doc } } });
  if ((body?.status?.matchedCount ?? 0) === 0) return null;
  return get(id);
}

async function remove(id) {
  if (USE_MOCK) {
    return mock.delete(id);
  }
  const body = await command({ deleteOne: { filter: { _id: id } } });
  return (body?.status?.deletedCount ?? 0) > 0;
}

/** Creates the collection if it doesn't exist yet (used by `npm run seed`). */
async function ensureCollection() {
  if (USE_MOCK) return { created: false, mock: true };
  const body = await command({ createCollection: { name: COLLECTION } });
  return { created: true, status: body };
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  ensureCollection,
  seedDocs,
  isMock: () => USE_MOCK,
  collectionUrl: () => (USE_MOCK ? '(mock store)' : COLLECTION_URL),
};
