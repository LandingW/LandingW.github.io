import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import {
  stopsInput,
  stopsFromJson,
  routeArcs,
  photonResults,
  stopFromPoint,
  type TripStop,
} from "../src/lib/trip-route";
import { albumInput } from "../src/lib/travel";
import { albumForm, formFingerprint } from "../src/lib/travel-editor";
import { tripPoints, mapCoordinates } from "../src/lib/trip-atlas";
import { tripLocation } from "../src/lib/trip-presentation";
import RouteEditor from "../src/components/travel/RouteEditor";
import TripAtlas from "../src/components/travel/TripAtlas";
import GrowingFractal from "../src/components/GrowingFractal";
import {
  dispatchProcessing,
  kickQueuedProcessing,
} from "../workers/photos/src/processing";
import { searchPlaces } from "../workers/photos/src/places";
import type { Env } from "../workers/photos/src/index";

const stops: TripStop[] = [
  {
    id: "stay",
    name: "Test hotel",
    kind: "stay",
    note: "One night",
    latitude: 0,
    longitude: 179,
  },
  {
    id: "view",
    name: "Test viewpoint",
    kind: "sight",
    note: "",
    latitude: 1,
    longitude: -179,
  },
];
test("ordered stops round-trip without inventing coordinates or erasing legacy fields", () => {
  assert.deepEqual(stopsFromJson(JSON.stringify(stops)), stops);
  assert.equal(stopsInput(undefined).length, 0);
  assert.throws(() => stopsInput([stops[0], stops[0]]), /不重复/);
  for (const latitude of [null, "", NaN, 91])
    assert.throws(() => stopsInput([{ ...stops[0], latitude }]));
  assert.throws(() =>
    stopsInput(
      Array.from({ length: 41 }, (_, i) => ({ ...stops[0], id: `p${i}` })),
    ),
  );
  assert.throws(() => stopsInput([{ ...stops[0], kind: "__proto__" }]));
  const a = { id: "trip", ...albumInput({ title: "Trip", stops }) };
  assert.deepEqual(albumForm(a).stops, stops);
  assert.notEqual(
    formFingerprint(albumForm(a)),
    formFingerprint({ ...albumForm(a), stops: [...stops].reverse() }),
  );
  assert.deepEqual(tripLocation(a, []), { latitude: 0, longitude: 179 });
  const points = tripPoints(a, []);
  assert.equal(points.length, 2);
  assert.equal(points[0].stopIndex, 0);
  assert.equal(points[0].source, "stop");
});

test("route curves follow ordered endpoints, bend smoothly and fit the date line", () => {
  const coords = mapCoordinates(stops);
  const arcs = routeArcs(coords);
  assert.equal(arcs.length, 1);
  assert.deepEqual(arcs[0][0], coords[0]);
  assert.deepEqual(arcs[0].at(-1), coords[1]);
  assert.ok(Math.abs(coords[0][1] - coords[1][1]) < 5);
  assert.notEqual(arcs[0][16][0], 0.5);
  assert.ok(arcs[0].flat().every(Number.isFinite));
  assert.equal(
    routeArcs([
      [0, 0],
      [0, 0],
    ]).length,
    0,
  );
  assert.equal(
    routeArcs([
      [0, 0],
      [NaN, 1],
    ]).length,
    0,
  );
  assert.ok(
    routeArcs([
      [85, 0],
      [84, 2],
    ])[0]
      .flat()
      .every(Number.isFinite),
  );
});

const photon = {
  features: [
    {
      properties: {
        name: "Test hotel",
        osm_type: "N",
        osm_id: 123,
        osm_value: "hotel",
        country: "Norway",
        ignored: "private",
      },
      geometry: { type: "Point", coordinates: [17.99, 69.63] },
    },
  ],
};
test("search results keep independent itinerary identities for selection and repeat visits", () => {
  const result = photonResults(photon)[0];
  const first = stopFromPoint("visit-one", result, result.name, result.kind);
  const second = stopFromPoint("visit-two", result, result.name, result.kind);
  assert.equal(first.id, "visit-one");
  assert.equal(second.id, "visit-two");
  assert.equal(stopsInput([first, second]).length, 2);
  assert.ok(!Object.hasOwn(first, "address"));
});
test("place results are bounded, normalized, attributed by UI and never guess missing locations", () => {
  const result = photonResults(photon)[0];
  assert.equal(result.kind, "stay");
  assert.equal(result.latitude, 69.63);
  assert.equal(result.longitude, 17.99);
  assert.ok(!JSON.stringify(result).includes("private"));
  assert.equal(
    photonResults({
      features: [{ properties: {}, geometry: { coordinates: [null, null] } }],
    }).length,
    0,
  );
  const html = renderToStaticMarkup(
    createElement(RouteEditor, {
      stops: [],
      anchor: null,
      place: "",
      disabled: false,
      apiUrl: "https://test.example",
      token: "hidden-token",
      onChange: () => {},
    }),
  );
  assert.match(html, /搜索酒店、景点/);
  assert.match(html, /Photon/);
  assert.match(html, /在地图上添加/);
  assert.doesNotMatch(html, /hidden-token/);
  const atlas = renderToStaticMarkup(
    createElement(TripAtlas, {
      album: { id: "a", ...albumInput({ title: "A", stops }) },
      photos: [],
      config: { apiUrl: "", mediaUrl: "https://media.example" },
      onOpen: () => {},
    }),
  );
  assert.match(atlas, /Test hotel/);
  assert.match(atlas, /One night/);
  assert.match(atlas, /不代表实际行走或导航路线/);
});

test(
  "processing wakeups are debounced and recoverable; explicit place searches are cached and rate limited",
  { timeout: 30000 },
  async (t) => {
    const mf = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        script: "export default {fetch(){return new Response('ok')}}",
        d1Databases: ["DB"],
      }),
    );
    try {
      const DB = await mf.getD1Database("DB");
      for (const name of (
        await fs.readdir("workers/photos/migrations")
      ).sort()) {
        const sql = await fs.readFile(
          `workers/photos/migrations/${name}`,
          "utf8",
        );
        await DB.batch(
          sql
            .split(";")
            .filter((s) => s.trim())
            .map((s) => DB.prepare(s)),
        );
      }
      const env = {
        DB,
        GITHUB_TOKEN: "test-only",
        GITHUB_REPOSITORY: "LandingW/LandingW.github.io",
      } as unknown as Env;
      let dispatches = 0,
        searches = 0,
        failDispatch = false;
      const realFetch = globalThis.fetch;
      t.mock.method(
        globalThis,
        "fetch",
        async (input: string | URL | Request, init?: RequestInit) => {
          const url = String(input);
          if (url.startsWith("https://api.github.com/")) {
            dispatches++;
            assert.deepEqual(JSON.parse(String(init?.body)), {
              ref: "main",
              inputs: {},
            });
            return new Response(null, { status: failDispatch ? 403 : 204 });
          }
          if (url.startsWith("https://photon.komoot.io/")) {
            searches++;
            return Response.json(photon);
          }
          return realFetch(input, init);
        },
      );
      await kickQueuedProcessing(env);
      assert.equal(dispatches, 0, "empty queues never start Actions");
      await DB.prepare(
        "INSERT INTO photos(id,album_id,original_key,filename,mime,bytes,fingerprint,state,created_at,updated_at) VALUES('q','photo-library','originals/q/source','q.jpg','image/jpeg',1,'q','queued','2026-01-01','2026-01-01')",
      ).run();
      await Promise.all([kickQueuedProcessing(env), kickQueuedProcessing(env)]);
      assert.equal(dispatches, 1, "concurrent upload completions coalesce");
      await DB.prepare(
        "UPDATE service_limits SET next_at=0 WHERE key='photo-dispatch'",
      ).run();
      await kickQueuedProcessing(env);
      assert.equal(
        dispatches,
        2,
        "cron sweep can wake a queue left behind after a previous runner exits",
      );
      await DB.prepare(
        "UPDATE photos SET state='processing',updated_at=? WHERE id='q'",
      )
        .bind(new Date().toISOString())
        .run();
      await DB.prepare(
        "UPDATE service_limits SET next_at=0 WHERE key='photo-dispatch'",
      ).run();
      await kickQueuedProcessing(env);
      assert.equal(
        dispatches,
        2,
        "active processors do not spawn more runners",
      );
      failDispatch = true;
      await assert.rejects(dispatchProcessing(env), /Actions/);
      const event = await DB.prepare(
        "SELECT value FROM service_events WHERE key='photo-dispatch'",
      ).first<{ value: string }>();
      assert.equal(JSON.parse(event!.value).ok, false);
      assert.doesNotMatch(event!.value, /test-only/);
      const first = await searchPlaces(env, { query: "Test hotel Norway" });
      const second = await searchPlaces(env, { query: "Test hotel Norway" });
      assert.deepEqual(first.results, second.results);
      assert.equal(second.cached, true);
      assert.equal(searches, 1);
      await assert.rejects(
        searchPlaces(env, { query: "Another place" }),
        /稍等一秒/,
      );
      await assert.rejects(searchPlaces(env, { query: "x" }), /2–160/);
    } finally {
      t.mock.restoreAll();
      await mf.dispose();
    }
  },
);

test("upload completion wakes the backend and mobile fractals use a continuous portrait field", async () => {
  const worker = await fs.readFile("workers/photos/src/index.ts", "utf8");
  assert.match(
    worker,
    /state='queued'[\s\S]{0,180}ctx\.waitUntil\(kickQueuedProcessing/,
  );
  const config = await fs.readFile("workers/photos/wrangler.jsonc", "utf8");
  assert.match(config, /\*\/5 \* \* \* \*/);
  const component = renderToStaticMarkup(createElement(GrowingFractal));
  const styles = await fs.readFile("src/app/globals.css", "utf8");
  assert.equal(
    (component.match(/data-renderer="julia-ink-scroll"/g) || []).length,
    1,
  );
  assert.match(styles, /\.page-fractal\s*\{[^}]*height: 100lvh/);
});

test(
  "dispatch and place search run inside workerd without unsupported redirect modes",
  { timeout: 30000 },
  async () => {
    const bundle = await build({
      stdin: {
        contents: `import {dispatchProcessing} from './workers/photos/src/processing';
        import {searchPlaces} from './workers/photos/src/places';
        export default {async fetch(request,env){try {
          if(new URL(request.url).pathname==='/dispatch') {await dispatchProcessing(env);return Response.json({ok:true});}
          return Response.json(await searchPlaces(env,{query:'Test hotel Norway'}));
        }catch(e){return Response.json({error:e.message},{status:502});}}};`,
        resolveDir: process.cwd(),
        loader: "ts",
      },
      bundle: true,
      format: "esm",
      platform: "browser",
      write: false,
    });
    let redirect = false;
    let requests = 0;
    const mf = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        script: bundle.outputFiles[0].text,
        d1Databases: ["DB"],
        bindings: {
          GITHUB_TOKEN: "test-only",
          GITHUB_REPOSITORY: "LandingW/LandingW.github.io",
        },
        outboundService: async (request) => {
          requests++;
          if (request.url.startsWith("https://api.github.com/"))
            return new Response(
              null,
              redirect
                ? {
                    status: 302,
                    headers: { Location: "https://not-allowed.example/" },
                  }
                : { status: 204 },
            );
          assert.ok(request.url.startsWith("https://photon.komoot.io/api/"));
          return Response.json(photon);
        },
      }),
    );
    try {
      const db = await mf.getD1Database("DB");
      await db.batch([
        db.prepare(
          "CREATE TABLE service_events(key TEXT PRIMARY KEY,value TEXT)",
        ),
        db.prepare(
          "CREATE TABLE service_limits(key TEXT PRIMARY KEY,next_at INTEGER)",
        ),
        db.prepare(
          "CREATE TABLE place_search_cache(key TEXT PRIMARY KEY,results_json TEXT,expires_at INTEGER)",
        ),
      ]);
      const dispatch = await mf.dispatchFetch("http://localhost/dispatch");
      assert.equal(dispatch.status, 200, await dispatch.text());
      const search = await mf.dispatchFetch("http://localhost/search");
      assert.equal(search.status, 200);
      assert.equal(
        ((await search.json()) as { results: unknown[] }).results.length,
        1,
      );
      assert.equal(requests, 2);
      redirect = true;
      const rejected = await mf.dispatchFetch("http://localhost/dispatch");
      assert.equal(rejected.status, 502);
      assert.match(await rejected.text(), /HTTP 302/);
      assert.equal(requests, 3, "credentials never follow the redirect");
    } finally {
      await mf.dispose();
    }
  },
);
