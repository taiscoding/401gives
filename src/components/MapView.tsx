"use client";

import { useState, useCallback, useEffect } from "react";
import Map, {
  Source,
  Layer,
  NavigationControl,
  type MapLayerMouseEvent,
  type ViewStateChangeEvent,
} from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMapCamera } from "@/hooks/useMapCamera";
import { COUNTY_BOUNDARIES, RI_CENTER } from "@/data/ri-geography";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Dark style overrides for Mapbox
const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

interface MapViewProps {
  onCountyClick?: (county: string) => void;
  onCountyHover?: (county: string | null, x: number, y: number) => void;
  onZoomChange?: (zoom: number) => void;
}

export default function MapView({ onCountyClick, onCountyHover, onZoomChange }: MapViewProps) {
  const { mapRef, flyToCounty, resetView } = useMapCamera();
  const [hoveredCounty, setHoveredCounty] = useState<string | null>(null);
  const [zoom, setZoom] = useState(9);

  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Add 3D terrain
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.terrain-rgb",
      tileSize: 512,
      maxzoom: 14,
    });
    map.setTerrain({ source: "mapbox-dem", exaggeration: 2.0 });

    // Add sky layer for atmosphere
    map.addLayer({
      id: "sky",
      type: "sky",
      paint: {
        "sky-type": "atmosphere",
        "sky-atmosphere-sun": [0.0, 0.0],
        "sky-atmosphere-sun-intensity": 5,
        "sky-atmosphere-color": "rgba(0, 5, 15, 1)",
      },
    });
  }, [mapRef]);

  const onMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const features = e.features;
      if (features && features.length > 0) {
        const county = features[0].properties?.name || null;
        setHoveredCounty(county);
        onCountyHover?.(county, e.point.x, e.point.y);
      } else {
        setHoveredCounty(null);
        onCountyHover?.(null, 0, 0);
      }
    },
    [onCountyHover]
  );

  const onMouseLeave = useCallback(() => {
    setHoveredCounty(null);
    onCountyHover?.(null, 0, 0);
  }, [onCountyHover]);

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const features = e.features;
      if (features && features.length > 0) {
        const county = features[0].properties?.name;
        if (county) {
          onCountyClick?.(county);
          flyToCounty(county);
        }
      }
    },
    [onCountyClick, flyToCounty]
  );

  const onMove = useCallback(
    (e: ViewStateChangeEvent) => {
      const newZoom = e.viewState.zoom;
      if (Math.abs(newZoom - zoom) > 0.5) {
        setZoom(newZoom);
        onZoomChange?.(newZoom);
      }
    },
    [zoom, onZoomChange]
  );

  if (!MAPBOX_TOKEN) {
    return (
      <div className="map-container flex items-center justify-center">
        <p className="font-sohne-mono text-xs uppercase tracking-wider text-text-muted">
          MAPBOX TOKEN REQUIRED
        </p>
      </div>
    );
  }

  return (
    <div className="map-container">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: RI_CENTER.lng,
          latitude: RI_CENTER.lat,
          zoom: 9,
          pitch: 45,
          bearing: 0,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        terrain={{ source: "mapbox-dem", exaggeration: 2.0 }}
        interactiveLayerIds={["county-fill"]}
        onLoad={onMapLoad}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        onMove={onMove}
        maxBounds={[
          [-72.1, 41.0], // SW
          [-71.0, 42.1], // NE
        ]}
        minZoom={8}
        maxZoom={18}
      >
        {/* County boundaries */}
        <Source id="counties" type="geojson" data={COUNTY_BOUNDARIES}>
          <Layer
            id="county-fill"
            type="fill"
            paint={{
              "fill-color": [
                "case",
                ["==", ["get", "name"], hoveredCounty || ""],
                "rgba(34, 211, 238, 0.12)",
                "rgba(34, 211, 238, 0.04)",
              ],
              "fill-opacity": 1,
            }}
          />
          <Layer
            id="county-border"
            type="line"
            paint={{
              "line-color": [
                "case",
                ["==", ["get", "name"], hoveredCounty || ""],
                "rgba(34, 211, 238, 0.4)",
                "rgba(34, 211, 238, 0.15)",
              ],
              "line-width": [
                "case",
                ["==", ["get", "name"], hoveredCounty || ""],
                2,
                1,
              ],
            }}
          />
          <Layer
            id="county-label"
            type="symbol"
            layout={{
              "text-field": ["upcase", ["get", "name"]],
              "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
              "text-size": 11,
              "text-letter-spacing": 0.15,
            }}
            paint={{
              "text-color": "rgba(34, 211, 238, 0.5)",
              "text-halo-color": "rgba(0, 0, 0, 0.8)",
              "text-halo-width": 1,
            }}
            minzoom={9}
            maxzoom={11.5}
          />
        </Source>
      </Map>

      {/* Reset view button */}
      <button
        onClick={resetView}
        data-interactive
        className="fixed bottom-6 left-6 z-50 hud-panel px-3 py-2 text-xs font-sohne-mono uppercase tracking-wider text-text-secondary hover:text-signal transition-colors"
      >
        RESET VIEW
      </button>
    </div>
  );
}
