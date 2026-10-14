import {
  cameraFacts,
  type CameraMetadata,
  type EquipmentSources,
} from "@/lib/photo-metadata";

export default function PhotoFacts({
  camera,
  sources,
}: {
  camera: CameraMetadata | null | undefined;
  sources?: EquipmentSources;
}) {
  const facts = cameraFacts(camera, sources);
  if (!facts.length)
    return <p className="photo-facts-empty">未读取到拍摄参数。</p>;
  return (
    <dl className="photo-facts">
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>
            {fact.value}
            {fact.source && (
              <small className="equipment-source">{fact.source}</small>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
