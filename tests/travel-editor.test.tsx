import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  albumForm,
  formFingerprint,
  moveCover,
  publicationCheck,
} from "../src/lib/travel-editor";
import { albumInput, type TravelPhoto } from "../src/lib/travel";
import TripStory from "../src/components/travel/TripStory";
import Header from "../src/components/Header";

test("editor normalizes empty fields without losing zero coordinates or cover order", () => {
  const album = {
    id: "trip",
    ...albumInput({
      title: "Trip",
      latitude: 0,
      longitude: 0,
      coverPhotoIds: ["b", "a"],
    }),
  };
  const form = albumForm(album);
  assert.equal(form.latitude, "0");
  assert.equal(
    formFingerprint(form),
    formFingerprint({ ...form, equipmentDefaults: { make: "", model: " " } }),
  );
  assert.notEqual(
    formFingerprint(form),
    formFingerprint({ ...form, title: "Edited" }),
  );
  assert.notEqual(
    formFingerprint(form),
    formFingerprint({ ...form, coverPhotoIds: ["a", "b"] }),
  );
  assert.deepEqual(moveCover(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moveCover(["a", "b"], "a", -1), ["a", "b"]);
  assert.deepEqual(moveCover(["a", "b"], "missing", 1), ["a", "b"]);
});
test("publishing requires saved edits and all current-trip photos ready", () => {
  const ready = { state: "ready", published: 0 };
  assert.equal(publicationCheck([], false).canPublish, false);
  assert.equal(publicationCheck([ready], true).canPublish, false);
  for (const state of ["failed", "uploading", "queued", "processing"])
    assert.equal(
      publicationCheck([ready, { state, published: 0 }], false).canPublish,
      false,
    );
  assert.deepEqual(publicationCheck([ready, ready], false), {
    ready: 2,
    unfinished: 0,
    canPublish: true,
  });
});
test("travel story uses a chosen hero, real photo proportions and no fabricated metadata", () => {
  const album = {
    id: "trip",
    ...albumInput({ title: "<My trip>", coverPhotoIds: ["b"] }),
  };
  const photos: TravelPhoto[] = ["a", "b", "c"].map((id, index) => ({
    id,
    albumId: "trip",
    caption: "",
    width: index === 0 ? 800 : 1600,
    height: 1200,
    thumbnail: `photos/${id}/revision/thumbnail.jpg`,
    preview: `photos/${id}/revision/preview.jpg`,
    dzi: `photos/${id}/revision/image.dzi`,
  }));
  const html = renderToStaticMarkup(
    createElement(TripStory, {
      album,
      photos,
      config: { apiUrl: "", mediaUrl: "https://media.example.com" },
      onOpen: () => {},
      onBack: () => {},
    }),
  );
  assert.match(html, /&lt;My trip&gt;/);
  assert.match(html, /story-cover-photo/);
  assert.match(html, /b\/revision\/preview.jpg/);
  assert.match(html, /story-frame is-portrait|story-frame  is-portrait/);
  assert.match(html, /网格/);
  assert.doesNotMatch(html, /<dt>目的地<\/dt>|拍摄设备 \/|Google 地点/);
  assert.match(html, /这次旅行还没有公开的位置记录/);
  assert.match(html, /机身型号未记录/);
  assert.equal((html.match(/<figure class="story-frame/g) || []).length, 2);
});
test("travel is the fourth menu item linked to the homepage preview", () => {
  const html = renderToStaticMarkup(createElement(Header));
  const menu = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
  const links = [...menu.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(links.slice(0, 4), [
    "/#experience",
    "/#skills",
    "/#articles",
    "/#travel",
  ]);
  assert.doesNotMatch(html, /header-travel-link/);
});
