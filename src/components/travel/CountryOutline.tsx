"use client";

import { useMemo } from "react";
import { countryAt, countryDrawing } from "@/lib/country-geography";
import { coordinateLabel } from "@/lib/trip-atlas";
import type { PhotoLocation } from "@/lib/photo-metadata";

export default function CountryOutline({
  location,
  place,
}: {
  location: PhotoLocation | null;
  place: string;
}) {
  const country = useMemo(() => countryAt(location, place), [location, place]);
  const drawing = useMemo(
    () => (country ? countryDrawing(country, location) : null),
    [country, location],
  );
  return (
    <figure className="journey-country" data-reveal>
      <div className="country-caption">
        <span className="mono">
          国家轮廓{country ? ` / ${country.code}` : ""}
        </span>
        <span aria-hidden="true">↗</span>
      </div>
      {country && drawing ? (
        <>
          <svg
            className="country-outline"
            viewBox="0 0 360 294"
            role="img"
            aria-label={`${country.localName}轮廓${drawing.pin ? "及当前点位" : ""}`}
          >
            <g className="country-grid" aria-hidden="true">
              <path d="M0 74H360 M0 147H360 M0 220H360 M90 0V294 M180 0V294 M270 0V294" />
            </g>
            <path className="country-land" d={drawing.path} pathLength="1" />
            {drawing.pin && (
              <g
                className="country-marker"
                transform={`translate(${drawing.pin[0]},${drawing.pin[1]})`}
              >
                <circle className="country-pulse" r="14" />
                <circle r="4" />
              </g>
            )}
          </svg>
          <figcaption>
            <span>
              <strong>{country.localName}</strong>
              <em>{country.name}</em>
            </span>
            <span className="country-north mono" aria-label="上方为北方">
              ↑ N
            </span>
          </figcaption>
          <p className="country-provenance">
            Natural Earth · 国家轮廓示意
            {country.source === "place" ? " · 国家来自目的地名称" : ""}
          </p>
        </>
      ) : (
        <div className="country-unavailable">
          <span aria-hidden="true">⊕</span>
          <p>{location ? "未找到这个位置的国家轮廓" : "未填写旅行位置"}</p>
          <small>
            {location
              ? "已记录的坐标显示在下方"
              : "添加位置后可以显示对应的国家轮廓"}
          </small>
        </div>
      )}
      {location && (
        <div className="country-coordinates mono">
          {coordinateLabel(location)}
        </div>
      )}
    </figure>
  );
}
