"use client";

import { useState, useCallback, useEffect } from "react";

// ─── Types ──────────────────────────────────────────────────────

export type ExplorationLevel = "overview" | "city" | "cause" | "nonprofit";

export type ExplorationState =
  | { level: "overview" }
  | { level: "city"; city: string; county: string }
  | { level: "cause"; city: string; county: string; cause: string }
  | {
      level: "nonprofit";
      city: string;
      county: string;
      cause: string;
      nonprofitSlug: string;
    };

export interface CityData {
  name: string;
  county: string;
  count: number;
  lat: number;
  lng: number;
}

export interface CauseData {
  name: string;
  color: string;
  count: number;
}

export interface RelatedNonprofit {
  name: string;
  slug: string;
  city: string;
  logoUrl: string | null;
}

export interface NonprofitData {
  id: string;
  name: string;
  slug: string;
  city: string;
  county: string;
  lat: number;
  lng: number;
  logoUrl: string | null;
  mission: string | null;
  donateUrl: string | null;
  causes: string[];
  related?: RelatedNonprofit[];
}

// ─── Hook ───────────────────────────────────────────────────────

export function useExploration() {
  const [state, setState] = useState<ExplorationState>({ level: "overview" });
  const [cities, setCities] = useState<CityData[]>([]);
  const [causes, setCauses] = useState<CauseData[]>([]);
  const [nonprofits, setNonprofits] = useState<NonprofitData[]>([]);
  const [selectedNonprofit, setSelectedNonprofit] =
    useState<NonprofitData | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch city summaries on mount
  useEffect(() => {
    async function fetchCities() {
      setLoading(true);
      try {
        const res = await fetch("/api/nonprofits");
        const data = await res.json();
        setCities(data.cities || []);
      } catch (err) {
        console.error("Failed to fetch cities:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCities();
  }, []);

  // Select a county: show cities within that county (no API call needed, just filter locally)
  const selectCounty = useCallback(
    (county: string) => {
      // Use a placeholder city name — the "city" level here means "browsing cities within county"
      setState({ level: "city", city: "", county });
      setCauses([]);
      setNonprofits([]);
      setSelectedNonprofit(null);
    },
    []
  );

  // Select a city: fetch causes for that city
  const selectCity = useCallback(
    async (city: string, county: string) => {
      setState({ level: "city", city, county });
      setCauses([]);
      setNonprofits([]);
      setSelectedNonprofit(null);
      setLoading(true);
      try {
        const res = await fetch(
          `/api/nonprofits?city=${encodeURIComponent(city)}`
        );
        const data = await res.json();
        setCauses(data.causes || []);
      } catch (err) {
        console.error("Failed to fetch causes:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Select a cause: fetch nonprofits for city+cause
  const selectCause = useCallback(
    async (cause: string) => {
      if (state.level !== "city" && state.level !== "cause") return;
      const { city, county } = state;
      setState({ level: "cause", city, county, cause });
      setNonprofits([]);
      setSelectedNonprofit(null);
      setLoading(true);
      try {
        const res = await fetch(
          `/api/nonprofits?city=${encodeURIComponent(city)}&cause=${encodeURIComponent(cause)}`
        );
        const data = await res.json();
        setNonprofits(data.nonprofits || []);
      } catch (err) {
        console.error("Failed to fetch nonprofits:", err);
      } finally {
        setLoading(false);
      }
    },
    [state]
  );

  // Select a nonprofit
  const selectNonprofit = useCallback(
    (slug: string) => {
      if (state.level !== "cause" && state.level !== "nonprofit") return;
      const np = nonprofits.find((n) => n.slug === slug);
      if (!np) return;
      const { city, county, cause } = state as {
        city: string;
        county: string;
        cause: string;
      };
      setState({
        level: "nonprofit",
        city,
        county,
        cause,
        nonprofitSlug: slug,
      });
      setSelectedNonprofit(np);
    },
    [state, nonprofits]
  );

  // Go back one level
  const goBack = useCallback(() => {
    switch (state.level) {
      case "nonprofit": {
        const { city, county, cause } = state;
        setState({ level: "cause", city, county, cause });
        setSelectedNonprofit(null);
        break;
      }
      case "cause": {
        const { city, county } = state;
        setState({ level: "city", city, county });
        setNonprofits([]);
        setSelectedNonprofit(null);
        break;
      }
      case "city":
        setState({ level: "overview" });
        setCauses([]);
        setNonprofits([]);
        setSelectedNonprofit(null);
        break;
      default:
        break;
    }
  }, [state]);

  return {
    state,
    cities,
    causes,
    nonprofits,
    selectedNonprofit,
    loading,
    selectCounty,
    selectCity,
    selectCause,
    selectNonprofit,
    goBack,
  };
}
