import path from "node:path";
import { generatePhoto } from "./photo-processing";

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('用法：npm run photos:sample -- "照片的绝对路径"');
    process.exitCode = 1;
  } else {
    const output = path.resolve("photo-output", `sample-${Date.now()}`),
      start = performance.now();
    const result = await generatePhoto(path.resolve(input), output);
    console.log(
      JSON.stringify(
        {
          output,
          width: result.width,
          height: result.height,
          tiles: result.tileCount,
          derivedMB: +(result.derivedBytes / 1_000_000).toFixed(2),
          seconds: +((performance.now() - start) / 1000).toFixed(2),
        },
        null,
        2,
      ),
    );
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "处理失败");
  process.exitCode = 1;
});
