// @flow
import { fromLatLon } from "utm";
import format from "date-fns/format";
import esLocale from "date-fns/locale/es";

import type { LocationContextType } from "../context/LocationContext";
import type { ObservationValue } from "../context/ObservationsContext";
import type { Preset, PresetsMap } from "../context/PresetsContext";

export function getDisplayName(WrappedComponent: any) {
  return WrappedComponent.displayName || WrappedComponent.name || "Component";
}

// If the current position on the app state is more than 60 seconds old then we
// consider it stale and show that the GPS is searching for a new position
const STALE_TIMEOUT = 60 * 1000; // 60 seconds
// If the precision is less than 10 meters then we consider this to be a "good
// position" and we change the UI accordingly
const GOOD_PRECISION = 10; // 10 meters

export type LocationStatus = "searching" | "improving" | "good" | "error";

// Little helper to timeout a promise
export function promiseTimeout(
  promise: Promise<any>,
  ms: number,
  msg?: string
) {
  let timeoutId: TimeoutID;
  const timeout = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(msg || "Timeout after " + ms + "ms"));
    }, ms);
  });
  promise.finally(() => clearTimeout(timeoutId));
  return Promise.race([promise, timeout]);
}

export function getLocationStatus({
  position,
  provider,
  permission,
  error
}: LocationContextType): LocationStatus {
  const precision = position && position.coords.accuracy;
  const gpsUnavailable = provider && !provider.gpsAvailable;
  const locationServicesDisabled =
    provider && !provider.locationServicesEnabled;
  const noPermission = permission && permission !== "granted";
  const positionStale =
    position && Date.now() - position.timestamp > STALE_TIMEOUT;
  if (error || gpsUnavailable || locationServicesDisabled || noPermission)
    return "error";
  else if (positionStale) return "searching";
  else if (
    typeof precision === "number" &&
    Math.round(precision) <= GOOD_PRECISION
  )
    return "good";
  else if (typeof precision === "number") return "improving";
  return "searching";
}

// Get a matching preset from a Map of presets, for a given observation value
export function matchPreset(
  observationValue: ObservationValue,
  presets: PresetsMap
): Preset | void {
  const categoryId = observationValue.tags.categoryId;
  if (!categoryId) return;
  return presets.get(categoryId);
}

export function formatDate(date: string | number | Date): string {
  if (typeof date === "string" || typeof date === "number") {
    date = new Date(date);
  }
  return format(date, "D [de] MMMM [de] YYYY HH:mm", { locale: esLocale });
}

export function formatCoords({
  lon,
  lat,
  format = "utm"
}: {
  lon: number,
  lat: number,
  format?: "utm"
}): string {
  try {
    let { easting, northing, zoneNum, zoneLetter } = fromLatLon(lat, lon);
    easting = leftPad(easting.toFixed(), 6, "0");
    northing = leftPad(northing.toFixed(), 6, "0");
    return `UTM ${zoneNum}${zoneLetter} ${easting} ${northing}`;
  } catch (e) {
    // Some coordinates (e.g. < 80S or 84N) cannot be formatted as UTM
    return `${lat >= 0 ? "+" : ""}${lat.toFixed(6)}°, ${
      lon >= 0 ? "+" : ""
    }${lon.toFixed(6)}°`;
  }
}

function leftPad(str: string, len: number, char: string): string {
  // doesn't need to pad
  len = len - str.length;
  if (len <= 0) return str;

  var pad = "";
  while (true) {
    if (len & 1) pad += char;
    len >>= 1;
    if (len) char += char;
    else break;
  }
  return pad + str;
}
