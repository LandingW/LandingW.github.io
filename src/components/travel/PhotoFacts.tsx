import { cameraFacts, type CameraMetadata } from "@/lib/photo-metadata";

export default function PhotoFacts({
  camera,
}: {
  camera: CameraMetadata | null | undefined;
}) {
  const facts = cameraFacts(camera);
  if (!facts.length)
    return <p className="photo-facts-empty">照片没有记录可读取的摄影参数。</p>;
  return (
    <dl className="photo-facts">
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
