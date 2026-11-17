'use client';

// Slice 132 — shared Leaflet map (OpenStreetMap base, no key).
//
// Leaflet 1.9.4 from NPM (package.json), NOT a CDN script tag —
// the paste's bare "https://unpkg.com" links are broken (L would
// be undefined); the corrected unpkg URLs
// (unpkg.com/leaflet@1.9.4/dist/leaflet.css|js) are recorded only
// so no broken CDN link is ever used. The Leaflet JS is loaded
// with a dynamic import INSIDE useEffect, after a client-only
// mount — the module is never evaluated during server rendering.
// The CSS is a top-level side-effect import (no JS execution, so
// it is SSR-safe). No next/dynamic ssr:false is used.
//
// Layers:
//   * OSM base tiles (no key, free).
//   * Optional parcel polygon (FL cadastral geometry, WGS84 rings
//     from /api/parcel-boundary) — drawn ONLY when the live
//     response actually returned rings; never faked.
//   * Optional Census TIGERweb boundary polygon (county / ZCTA
//     GeoJSON from /api/boundary) — drawn only when the live
//     response returned a feature.
//   * Optional Regrid nationwide parcel-boundary tile overlay
//     (toggleable, off by default). VERIFIED LIVE Nov 17:
//     .../Regrid_Nationwide_Parcel_Boundaries_v1/MapServer?f=json
//     loads (capabilities Map/TilesOnly/Tilemap, one layer id 0,
//     minScale 20000, minLOD 15); the z=16 tile fetch returned
//     HTTP 200 with binary content the text crawler could not
//     extract — consistent with a PNG tile, no token required.
//     Tile URL:
//     https://tiles.arcgis.com/tiles/KzeiCaQsMoeCfoCq/arcgis/rest/services/Regrid_Nationwide_Parcel_Boundaries_v1/MapServer/tile/{z}/{y}/{x}
//     Parcels render ONLY at zoom 15+ (minLOD 15) — the map
//     defaults to zoom 17 for a precise point. Regrid tiles are
//     VISUAL BOUNDARIES ONLY; full owner attributes are paid
//     (Regrid Data Store) and are never claimed here.
//   * Marker: a circleMarker (no icon image assets to break) with
//     a popup at the matched address / centroid. The marker is the
//     address the service matched — for a public deal it is the
//     ZIP-area centroid, and the popup says so.

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';

export const REGRID_TILE_URL =
  'https://tiles.arcgis.com/tiles/KzeiCaQsMoeCfoCq/arcgis/rest/services/Regrid_Nationwide_Parcel_Boundaries_v1/MapServer/tile/{z}/{y}/{x}';

export interface MapCenter {
  lat: number;
  lng: number;
}

export default function PropertyMap({
  center,
  zoom = 17,
  markerLabel,
  parcelRings,
  boundaryGeojson,
  boundaryLabel,
  showRegridToggle = true,
  height = 320,
}: {
  center: MapCenter;
  zoom?: number;
  markerLabel?: string;
  // Parcel rings as [lng, lat] pairs (ArcGIS order), outer ring first.
  parcelRings?: [number, number][][] | null;
  // Census TIGERweb GeoJSON feature collection (county or ZCTA).
  boundaryGeojson?: { type: string; features?: unknown[] } | null;
  boundaryLabel?: string;
  showRegridToggle?: boolean;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [mounted, setMounted] = useState(false);
  const [regridOn, setRegridOn] = useState(false);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const ringsKey = JSON.stringify(parcelRings || null);
  const boundaryKey = JSON.stringify(boundaryGeojson || null);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;
    let cancelled = false;
    let map: LeafletMap | null = null;
    (async () => {
      try {
        const leaflet = await import('leaflet');
        if (cancelled || !containerRef.current) return;
        const L = leaflet.default;
        map = L.map(containerRef.current, { scrollWheelZoom: true }).setView([center.lat, center.lng], zoom);
        mapRef.current = map;
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
        }).addTo(map);
        if (boundaryGeojson && Array.isArray(boundaryGeojson.features) && boundaryGeojson.features.length > 0) {
          L.geoJSON(boundaryGeojson as never, {
            style: { color: '#64748b', weight: 2, fillOpacity: 0.05 },
          })
            .bindPopup(boundaryLabel || 'Boundary (U.S. Census TIGERweb)')
            .addTo(map);
        }
        if (parcelRings && parcelRings.length > 0) {
          const latlngs = parcelRings.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number]));
          L.polygon(latlngs, { color: '#0ea5e9', weight: 2, fillOpacity: 0.15 })
            .bindPopup('Parcel boundary — Florida Statewide Cadastral roll')
            .addTo(map);
        }
        if (regridOn) {
          L.tileLayer(REGRID_TILE_URL, {
            minZoom: 15,
            maxZoom: 17,
            attribution: 'Parcel boundaries © Regrid',
          }).addTo(map);
        }
        if (markerLabel) {
          L.circleMarker([center.lat, center.lng], {
            radius: 8,
            color: '#0f766e',
            weight: 2,
            fillColor: '#14b8a6',
            fillOpacity: 0.9,
          })
            .bindPopup(markerLabel)
            .addTo(map)
            .openPopup();
        }
      } catch {
        if (!cancelled) setMapError('The map could not be loaded just now.');
      }
    })();
    return () => {
      cancelled = true;
      if (map) {
        map.remove();
        mapRef.current = null;
      }
    };
    // Rebuild when the inputs change: the simplest correct update
    // for a small map (layers never go stale).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, center.lat, center.lng, zoom, markerLabel, ringsKey, boundaryKey, regridOn]);

  if (!mounted) {
    return (
      <div style={{ height, background: '#0f172a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#94a3b8' }}>
        Loading map…
      </div>
    );
  }

  return (
    <div>
      <div ref={containerRef} style={{ height, borderRadius: 10, zIndex: 0 }} />
      {mapError && <p style={{ fontSize: 13, color: '#fbbf24' }}>{mapError}</p>}
      {showRegridToggle && (
        <label style={{ display: 'block', fontSize: 13, marginTop: 6 }}>
          <input
            type="checkbox"
            checked={regridOn}
            onChange={(e) => setRegridOn(e.target.checked)}
          />{' '}
          Show Regrid parcel boundaries (visual lines only — parcel lines appear at zoom 15+; owner details are not included)
        </label>
      )}
      <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
        Base map © OpenStreetMap contributors. Parcel boundary from the Florida Statewide Cadastral roll when available; county / ZIP
        boundary from the U.S. Census TIGERweb. Regrid overlay © Regrid (visual boundaries only).
      </p>
    </div>
  );
}
