"use client";

import { useCallback, useRef } from "react";
import type { MapRef } from "react-map-gl";
import { COUNTY_CENTERS } from "@/data/ri-counties";
import { RI_CENTER } from "@/data/ri-geography";

export function useMapCamera() {
  const mapRef = useRef<MapRef>(null);

  const flyToCounty = useCallback((county: string) => {
    const center = COUNTY_CENTERS[county];
    if (!center || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [center.lng, center.lat],
      zoom: 11,
      pitch: 50,
      duration: 1200,
    });
  }, []);

  const flyToCity = useCallback((lat: number, lng: number) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [lng, lat],
      zoom: 13,
      pitch: 55,
      duration: 1200,
    });
  }, []);

  const flyToNonprofit = useCallback((lat: number, lng: number) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [lng, lat],
      zoom: 15,
      pitch: 60,
      duration: 1000,
    });
  }, []);

  const resetView = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [RI_CENTER.lng, RI_CENTER.lat],
      zoom: 9,
      pitch: 45,
      bearing: 0,
      duration: 1500,
    });
  }, []);

  return { mapRef, flyToCounty, flyToCity, flyToNonprofit, resetView };
}
