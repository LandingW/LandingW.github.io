"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  MAX_TRIP_STOPS,
  STOP_KINDS,
  stopFromPoint,
  type TripStop,
  type PlaceResult,
  type StopKind,
} from "@/lib/trip-route";
import { coordinateLabel } from "@/lib/trip-atlas";
import { normalizeLocation, type PhotoLocation } from "@/lib/photo-metadata";
import { photoApi } from "@/lib/travel-client";
import { moveCover } from "@/lib/travel-editor";
const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="route-editor-map route-map-loading">正在加载地图…</div>
  ),
});

export default function RouteEditor({
  stops,
  anchor,
  place,
  disabled,
  apiUrl,
  token,
  onChange,
}: {
  stops: TripStop[];
  anchor: PhotoLocation | null;
  place: string;
  disabled: boolean;
  apiUrl: string;
  token: string;
  onChange: (stops: TripStop[]) => void;
}) {
  const [selected, setSelected] = useState(stops[0]?.id || "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [placing, setPlacing] = useState(false);
  const [showMap, setShowMap] = useState(stops.length > 0);
  const dragged = useRef<string | null>(null);
  const active = stops.find((stop) => stop.id === selected) || stops[0];
  const full = stops.length >= MAX_TRIP_STOPS;
  async function search() {
    if (searching || disabled) return;
    setSearching(true);
    setError("");
    setResults([]);
    setSearched(false);
    try {
      const response = await photoApi<{ results: PlaceResult[] }>(
        apiUrl,
        token,
        "/admin/places/search",
        { query },
      );
      setResults(response.results);
      setSearched(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "地点搜索暂时不可用");
    } finally {
      setSearching(false);
    }
  }
  function add(point: PhotoLocation, result?: PlaceResult) {
    if (full || disabled) return;
    const id = crypto.randomUUID();
    onChange([
      ...stops,
      stopFromPoint(
        id,
        point,
        result?.name || `地点 ${stops.length + 1}`,
        result?.kind,
      ),
    ]);
    setSelected(id);
    setPlacing(false);
    setShowMap(true);
    setResults([]);
    setSearched(false);
  }
  function update(id: string, value: Partial<TripStop>) {
    onChange(
      stops.map((stop) => (stop.id === id ? { ...stop, ...value } : stop)),
    );
  }
  function reorder(id: string, direction: -1 | 1) {
    const ids = moveCover(
      stops.map((stop) => stop.id),
      id,
      direction,
    );
    onChange(ids.map((id) => stops.find((stop) => stop.id === id)!));
  }
  return (
    <section className="route-editor" aria-label="多地点行程编辑">
      <header className="route-editor-heading">
        <div>
          <p className="eyebrow">ROUTE</p>
          <h3>
            行程地点<span className="accent">.</span>
          </h3>
          <p>添加酒店、景点等地点，按行程排序。图钉可以拖到准确位置。</p>
        </div>
        <span className="route-total mono">
          {String(stops.length).padStart(2, "0")} / {MAX_TRIP_STOPS}
        </span>
      </header>
      <div className="route-search">
        <label>
          搜索酒店、景点或地名
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={160}
            placeholder={
              place
                ? `例如：${place} 的酒店名称`
                : "例如：Sommarøy Arctic Hotel Norway"
            }
            disabled={disabled || searching}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void search();
              }
            }}
          />
        </label>
        <button
          type="button"
          className="travel-button"
          onClick={() => void search()}
          disabled={disabled || searching || query.trim().length < 2}
        >
          {searching ? "查找中…" : "查找地点 ↗"}
        </button>
      </div>
      <p className="route-search-credit">
        搜索使用 Photon /
        OpenStreetMap。点击查找后才发送关键词，不读取设备位置。
        搜不到时可以直接在地图上选点。
      </p>
      {error && (
        <p className="manager-notice is-error" role="alert">
          {error}
        </p>
      )}
      {searched && !results.length && (
        <p className="manager-notice" role="status">
          没有匹配结果。试试当地语言名称并加上城市，或直接在地图上添加。
        </p>
      )}
      {!!results.length && (
        <div className="route-search-results" aria-label="地点搜索结果">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              disabled={disabled || full}
              onClick={() => add(result, result)}
            >
              <span className="route-kind">{STOP_KINDS[result.kind]}</span>
              <span>
                <strong>{result.name}</strong>
                <small>{result.address}</small>
              </span>
              <span>添加 ＋</span>
            </button>
          ))}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
          >
            © OpenStreetMap contributors · Photon
          </a>
        </div>
      )}
      <div className="route-editor-actions">
        <button
          type="button"
          disabled={disabled || full}
          className={placing ? "is-active" : ""}
          onClick={() => {
            setPlacing((old) => !old);
            setShowMap(true);
          }}
        >
          {placing ? "取消地图添加" : "＋ 在地图上添加一站"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setShowMap((old) => !old);
            setPlacing(false);
          }}
        >
          {showMap ? "收起地图" : "展开地图"}
        </button>
        {!stops.length && anchor && (
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              add(anchor, {
                ...anchor,
                id: "existing",
                name: place || "原旅行地点",
                address: "",
                kind: "place",
              })
            }
          >
            将原旅行定位设为第一站 ↗
          </button>
        )}
      </div>
      {full && (
        <p className="manager-help">已达 {MAX_TRIP_STOPS} 个站点上限。</p>
      )}
      <div className="route-editor-layout" data-map={showMap}>
        <div className="route-editor-index">
          {!stops.length && (
            <div className="route-empty">
              <span aria-hidden="true">⊕</span>
              <h4>还没有添加地点</h4>
              <p>搜索地名，或点击地图添加。已有的旅行定位和照片保持不变。</p>
            </div>
          )}
          <ol className="route-stop-list">
            {stops.map((stop, index) => (
              <li
                key={stop.id}
                data-active={active?.id === stop.id}
                onDragOver={(event) => {
                  if (!disabled) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const from = dragged.current;
                  dragged.current = null;
                  if (!from || from === stop.id || disabled) return;
                  const next = stops.filter((s) => s.id !== from);
                  next.splice(
                    index,
                    0,
                    stops.find((s) => s.id === from)!,
                  );
                  onChange(next);
                }}
              >
                <button
                  type="button"
                  className="route-stop-pick"
                  aria-pressed={active?.id === stop.id}
                  onClick={() => {
                    setSelected(stop.id);
                    setShowMap(true);
                  }}
                  disabled={disabled}
                >
                  <span className="route-stop-number mono">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{stop.name || "未命名地点"}</strong>
                    <small>{STOP_KINDS[stop.kind]}</small>
                  </span>
                </button>
                <div className="route-stop-order">
                  <button
                    type="button"
                    draggable={!disabled}
                    onDragStart={(event) => {
                      dragged.current = stop.id;
                      event.dataTransfer.setData("text/plain", stop.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      dragged.current = null;
                    }}
                    disabled={disabled}
                    aria-label={`拖动排序 ${stop.name}`}
                    title="拖动排序，也可使用前移和后移"
                  >
                    ⠿
                  </button>
                  <button
                    type="button"
                    disabled={disabled || index === 0}
                    aria-label={`${stop.name} 站点前移`}
                    onClick={() => reorder(stop.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={disabled || index === stops.length - 1}
                    aria-label={`${stop.name} 站点后移`}
                    onClick={() => reorder(stop.id, 1)}
                  >
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
        {showMap && (
          <RouteMap
            stops={stops}
            anchor={anchor}
            selected={active?.id || ""}
            placing={placing}
            disabled={disabled}
            onSelect={setSelected}
            onAdd={(point) => add(point)}
            onMove={(id, point) => {
              update(id, point);
              setSelected(id);
            }}
          />
        )}
      </div>
      {active && (
        <div className="route-stop-editor" key={active.id}>
          <div className="route-stop-detail-title">
            <span className="eyebrow">
              STOP {String(stops.indexOf(active) + 1).padStart(2, "0")}
            </span>
            <span className="mono">{coordinateLabel(active, 5)}</span>
          </div>
          <div className="manager-fields">
            <label>
              地点名称
              <input
                value={active.name}
                maxLength={120}
                required
                disabled={disabled}
                onChange={(event) =>
                  update(active.id, { name: event.target.value })
                }
              />
            </label>
            <label>
              地点类型
              <select
                value={active.kind}
                disabled={disabled}
                onChange={(event) =>
                  update(active.id, { kind: event.target.value as StopKind })
                }
              >
                {Object.entries(STOP_KINDS).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            地点备注（可选）
            <textarea
              value={active.note}
              rows={2}
              maxLength={400}
              disabled={disabled}
              placeholder="可以写住宿、交通或游玩记录"
              onChange={(event) =>
                update(active.id, { note: event.target.value })
              }
            />
          </label>
          <div className="route-detail-actions">
            <Coordinates
              key={`${active.id}-${active.latitude}-${active.longitude}`}
              point={active}
              disabled={disabled}
              onChange={(point) => update(active.id, point)}
            />
            <button
              type="button"
              className="library-danger"
              disabled={disabled}
              onClick={() => {
                onChange(stops.filter((stop) => stop.id !== active.id));
                setSelected("");
              }}
            >
              移除此站
            </button>
          </div>
        </div>
      )}
      <p className="route-editor-note">
        添加或调整后，需要保存旅行。已发布的行程会随保存更新；地图弧线只表示地点顺序，不是导航路线。
      </p>
    </section>
  );
}

function Coordinates({
  point,
  disabled,
  onChange,
}: {
  point: PhotoLocation;
  disabled: boolean;
  onChange: (point: PhotoLocation) => void;
}) {
  const [lat, setLat] = useState(String(point.latitude)),
    [lon, setLon] = useState(String(point.longitude));
  const [error, setError] = useState("");
  return (
    <details className="route-coordinates">
      <summary>精确经纬度</summary>
      <div className="manager-fields">
        <label>
          站点纬度
          <input
            type="number"
            step="any"
            value={lat}
            min={-90}
            max={90}
            disabled={disabled}
            onChange={(event) => setLat(event.target.value)}
          />
        </label>
        <label>
          站点经度
          <input
            type="number"
            step="any"
            value={lon}
            min={-180}
            max={180}
            disabled={disabled}
            onChange={(event) => setLon(event.target.value)}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          const value =
            lat.trim() && lon.trim()
              ? normalizeLocation({
                  latitude: Number(lat),
                  longitude: Number(lon),
                })
              : null;
          if (value) {
            setError("");
            onChange(value);
          } else setError("请填写有效的经纬度");
        }}
      >
        应用坐标
      </button>
      {error && <p role="alert">{error}</p>}
      <p>应用后，再保存旅行信息。</p>
    </details>
  );
}
