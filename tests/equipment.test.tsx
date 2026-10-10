import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readExifBlock } from "../scripts/photo-exif";
import {
  equipmentInput,
  resolveEquipment,
  normalizeCamera,
  lensSpecificationLabel,
} from "../src/lib/photo-metadata";
import PhotoFacts from "../src/components/travel/PhotoFacts";

test("equipment resolution respects photo overrides, EXIF and trip defaults without changing exposure", () => {
  const exif = {
    make: "EXIF brand",
    model: "Recorded body",
    lens: "Recorded lens",
    iso: 640,
    focalLength: 22,
  };
  const defaults = {
    make: "Trip brand",
    model: "Trip body",
    lens: "Trip lens",
  };
  const original = resolveEquipment(exif, {}, defaults);
  assert.equal(original.camera?.model, "Recorded body");
  assert.equal(original.equipmentSources.camera, "exif");
  const supplied = resolveEquipment(
    exif,
    { model: "Corrected body" },
    defaults,
  );
  assert.equal(supplied.camera?.model, "Corrected body");
  assert.equal(supplied.camera?.make, undefined);
  assert.equal(supplied.camera?.lens, "Recorded lens");
  assert.equal(supplied.camera?.iso, 640);
  assert.equal(supplied.equipmentSources.camera, "photo");
  const missing = resolveEquipment({ iso: 100 }, {}, defaults);
  assert.equal(missing.camera?.model, "Trip body");
  assert.equal(missing.equipmentSources.lens, "trip");
  assert.deepEqual(
    equipmentInput({ model: "Body", serialNumber: "DO_NOT_KEEP", iso: 12800 }),
    { model: "Body" },
  );
  assert.throws(() => equipmentInput({ model: { invalid: true } }));
});

test("lens specification is read as an EXIF specification, never guessed into a model name", async () => {
  const buffer = await sharp({
    create: { width: 16, height: 16, channels: 3, background: "#888" },
  })
    .jpeg()
    .withExif({
      IFD2: {
        LensMake: "Example lens maker",
        LensSpecification: "16/1 35/1 28/10 28/10",
      },
    })
    .toBuffer();
  const result = await readExifBlock((await sharp(buffer).metadata()).exif);
  assert.equal(result.camera?.lensMake, "Example lens maker");
  assert.deepEqual(result.camera?.lensSpec, {
    minFocal: 16,
    maxFocal: 35,
    minAperture: 2.8,
    maxAperture: 2.8,
  });
  assert.equal(result.camera?.lens, undefined);
  assert.equal(
    lensSpecificationLabel(result.camera!.lensSpec!),
    "16–35 mm f/2.8",
  );
  assert.equal(normalizeCamera({ lensSpec: [35, 16, 2.8, 2.8] }), null);
});

test("manually supplied device names have visible provenance and are escaped", () => {
  const resolved = resolveEquipment(
    { iso: 200 },
    { model: "<script>bad</script>" },
    { lens: "Trip lens" },
  );
  const html = renderToStaticMarkup(
    createElement(PhotoFacts, {
      camera: resolved.camera,
      sources: resolved.equipmentSources,
    }),
  );
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /手动补录/);
  assert.match(html, /旅行默认/);
  assert.match(html, /200/);
});
