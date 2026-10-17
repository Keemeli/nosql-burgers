# NoSQL Burgers — Astra DB Document API project

Course project for the freeCodeCamp **Learn NoSQL in 3 Hours** course (Ania Kubów),
**Project 1 — How to use the Document API**.

A small full-stack app that lists your favourite burger restaurants. The data lives
as JSON documents in an Apache Cassandra / Astra DB **collection**, and is read and
written through Astra's schemaless **Document API** (no CQL, no fixed schema).

```
React (Vite)  ──►  Express API (:8000)  ──►  Astra DB Document API  ──►  collection "burger_info"
```

## What it demonstrates

| NoSQL concept | Where |
| --- | --- |
| Schemaless documents | each restaurant is one JSON document, no migrations |
| Nested objects | `location: { address, zip, website }` inside a document |
| Arrays | `ingredients: ["beef patty", "cheese", ...]` |
| Booleans / mixed types | `visited: true`, `zip` as an integer |
| Document API (REST) over Cassandra | `server/astra.js` — plain HTTP + `x-cassandra-token` |
| CRUD without SQL | `GET/POST/PUT/DELETE /burgers` |

## Layout

```
server/          Express API + Astra Document API client + seed script
client/          React app (Vite) that consumes the API
.env.example     copy to .env and fill in your Astra credentials
```

## 1. Create the database (Astra DB)

1. Sign in at <https://astra.datastax.com> and create a **Serverless (Vector) or
   Classic** database.
2. Create a **keyspace** named `burgers`.
3. Open the keyspace → **Document API** (or *Data Explorer → Collections*) and create
   a collection named `burger_info`.
4. Generate an **Application Token** with the *Database Administrator* role.

The endpoint for the collection follows this shape — this is what goes in `.env`:

```
https://<DATABASE_ID>-<REGION>.apps.astra.datastax.com/api/rest/v2/namespaces/burgers/collections/burger_info
```

## 2. Configure

```bash
cp .env.example .env
```

```ini
ASTRA_ENDPOINT=https://<db-id>-<region>.apps.astra.datastax.com/api/rest/v2/namespaces/burgers/collections/burger_info
ASTRA_TOKEN=AstraCS:...
PORT=8000
```

`.env` is git-ignored — never commit the token.

## 3. Install and run

```bash
npm run install:all     # installs server + client dependencies
npm run seed            # writes 4 starter documents into the collection
npm run server          # terminal 1 — API on http://localhost:8000
npm run client          # terminal 2 — UI on http://localhost:5173
```

Open <http://localhost:5173>.

### Running without a database

For UI work the API falls back to an in-memory store when `ASTRA_ENDPOINT` is empty,
or when `USE_MOCK=1` is set. The response shapes are identical, so the front end
needs no changes:

```bash
USE_MOCK=1 npm run server
```

## API

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| `GET` | `/health` | – | `{ ok, mode }` |
| `GET` | `/burgers` | – | array of documents |
| `GET` | `/burgers/:id` | – | one document |
| `POST` | `/burgers` | document JSON | `{ documentId }` |
| `PUT` | `/burgers/:id` | document JSON | updated document |
| `DELETE` | `/burgers/:id` | – | `204` |

Example document:

```json
{
  "name": "Bob's Burgers",
  "description": "Tasty burgers from a fictional TV restaurant",
  "ingredients": ["beef patty", "tomato", "cucumber", "lettuce", "cheese"],
  "visited": true,
  "location": {
    "address": "45 Lambda Drive",
    "zip": 12345,
    "website": "https://www.bobsburgers.com"
  }
}
```

## Notes

- Node 18+ only: the API uses the built-in `fetch`, so `node-fetch` (used in the
  video) is not needed.
- The video uses Create React App; this repo uses Vite, which is the current
  recommended React toolchain. Same app, faster dev server.
- `USE_MOCK=1` is for development only — the graded version runs against Astra.
