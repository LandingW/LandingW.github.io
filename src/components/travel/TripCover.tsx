import { mediaUrl, type TravelAlbum, type TravelPhoto } from "@/lib/travel";
import { tripCoverPhotos } from "@/lib/trip-presentation";

export default function TripCover({
  album,
  photos,
  mediaBase,
}: {
  album: TravelAlbum;
  photos: TravelPhoto[];
  mediaBase: string;
}) {
  const cover = tripCoverPhotos(album, photos);
  return (
    <div className="trip-cover" data-count={cover.length} aria-hidden="true">
      {cover.length ? (
        cover.map((photo, index) => (
          <div
            key={photo.id}
            className={index === 0 ? "trip-cover-main" : "trip-cover-detail"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl(mediaBase, photo.thumbnail)}
              alt=""
              width={photo.width}
              height={photo.height}
              loading="lazy"
              decoding="async"
            />
          </div>
        ))
      ) : (
        <span className="trip-cover-empty">照片准备中</span>
      )}
    </div>
  );
}
