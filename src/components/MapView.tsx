"use client";

import { useState, useCallback } from "react";
import Map, {
  Source,
  Layer,
  type MapLayerMouseEvent,
  type ViewStateChangeEvent,
} from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMapCamera } from "@/hooks/useMapCamera";
import {
  COUNTY_BOUNDARIES,
  RI_CENTER,
  RI_STATE_BOUNDARY,
  VOID_MASK,
} from "@/data/ri-geography";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Completely blank style: void black canvas, no labels, no roads, nothing.
// We render everything ourselves.
const BLANK_STYLE: mapboxgl.StyleSpecification = {
  version: 8,
  name: "void",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#000000",
      },
    },
  ],
  glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
};

interface MapViewProps {
  onCountyClick?: (county: string) => void;
  onCountyHover?: (county: string | null, x: number, y: number) => void;
  onZoomChange?: (zoom: number) => void;
}

export default function MapView({
  onCountyClick,
  onCountyHover,
  onZoomChange,
}: MapViewProps) {
  const { mapRef, flyToCounty, resetView } = useMapCamera();
  const [hoveredCounty, setHoveredCounty] = useState<string | null>(null);
  const [zoom, setZoom] = useState(9.5);

  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Add satellite raster tiles (Mapbox satellite imagery)
    map.addSource("satellite", {
      type: "raster",
      url: "mapbox://mapbox.satellite",
      tileSize: 256,
    });

    // Add DEM for 3D terrain
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });

    // Add satellite raster layer FIRST (below everything)
    map.addLayer(
      {
        id: "satellite-tiles",
        type: "raster",
        source: "satellite",
        paint: {
          "raster-saturation": -0.3, // slightly desaturated for the dark aesthetic
          "raster-brightness-max": 0.7, // dim it down
          "raster-contrast": 0.2, // more contrast
        },
      },
      "background" // insert above background but below everything else
    );

    // Enable 3D terrain
    map.setTerrain({ source: "mapbox-dem", exaggeration: 2.5 });

    // Sky atmosphere
    map.addLayer({
      id: "sky",
      type: "sky",
      paint: {
        "sky-type": "atmosphere",
        "sky-atmosphere-sun": [0.0, 80.0],
        "sky-atmosphere-sun-intensity": 5,
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
      if (Math.abs(newZoom - zoom) > 0.3) {
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
          zoom: 9.5,
          pitch: 50,
          bearing: -10,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={BLANK_STYLE}
        interactiveLayerIds={["county-fill"]}
        onLoad={onMapLoad}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        onMove={onMove}
        maxBounds={[
          [-72.2, 40.9],
          [-70.7, 42.2],
        ]}
        minZoom={8}
        maxZoom={18}
      >
        {/* VOID MASK: covers everything outside Rhode Island with pure black */}
        <Source id="void-mask" type="geojson" data={VOID_MASK}>
          <Layer
            id="void-mask-fill"
            type="fill"
            paint={{
              "fill-color": "#000000",
              "fill-opacity": 1,
            }}
          />
        </Source>

        {/* RI state border: cyan glow edge */}
        <Source id="ri-boundary" type="geojson" data={RI_STATE_BOUNDARY}>
          <Layer
            id="ri-border-glow"
            type="line"
            paint={{
              "line-color": "rgba(34, 211, 238, 0.15)",
              "line-width": 10,
              "line-blur": 8,
            }}
          />
          <Layer
            id="ri-border"
            type="line"
            paint={{
              "line-color": "rgba(34, 211, 238, 0.5)",
              "line-width": 1.5,
            }}
          />
        </Source>

        {/* County boundaries */}
        <Source id="counties" type="geojson" data={COUNTY_BOUNDARIES}>
          <Layer
            id="county-fill"
            type="fill"
            paint={{
              "fill-color": [
                "case",
                ["==", ["get", "name"], hoveredCounty || ""],
                "rgba(34, 211, 238, 0.15)",
                "rgba(0, 0, 0, 0)",
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
                "rgba(34, 211, 238, 0.5)",
                "rgba(34, 211, 238, 0.15)",
              ],
              "line-width": [
                "case",
                ["==", ["get", "name"], hoveredCounty || ""],
                2,
                0.8,
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
              "text-letter-spacing": 0.2,
            }}
            paint={{
              "text-color": "rgba(255, 255, 255, 0.7)",
              "text-halo-color": "rgba(0, 0, 0, 0.9)",
              "text-halo-width": 2,
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
