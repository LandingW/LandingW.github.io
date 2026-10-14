import { mediaUrl, type TravelAlbum, type TravelPhoto } from "@/lib/travel";
import { tripCoverPhotos } from "@/lib/trip-presentation";
import { tripTransitionName } from "@/lib/ui-motion";

export default function TripCover({
  album,
  photos,
  mediaBase,
  sharedTransition = false,
  largePreview = false,
}: {
  album: TravelAlbum;
  photos: TravelPhoto[];
  mediaBase: string;
  sharedTransition?: boolean;
  largePreview?: boolean;
}) {
  const cover = tripCoverPhotos(album, photos);
  return (
    <div className="trip-cover" data-count={cover.length} aria-hidden="true">
      {cover.length ? (
        cover.map((photo, index) => (
          <div
            key={photo.id}
            className={index === 0 ? "trip-cover-main" : "trip-cover-detail"}
            style={
              index === 0 && sharedTransition
                ? { viewTransitionName: tripTransitionName(album.id) }
                : undefined
            }
          >
            <picture>
              {index === 0 && largePreview && (
                <source
                  media="(min-width: 761px)"
                  srcSet={mediaUrl(mediaBase, photo.preview)}
                />
              )}
              <img
                src={mediaUrl(mediaBase, photo.thumbnail)}
                alt=""
                width={photo.width}
                height={photo.height}
                loading="lazy"
                decoding="async"
              />
            </picture>
          </div>
        ))
      ) : (
        <span className="trip-cover-empty">暂无照片</span>
      )}
    </div>
  );
}
