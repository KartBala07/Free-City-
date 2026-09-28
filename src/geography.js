// Geographic coordinates are longitude, latitude (WGS84).
export const HOME = {
  center: [-122.4008, 37.793],
  zoom: 15.6,
  pitch: 62,
  bearing: -32,
};
export const PLACES = {
  downtown: { label: "Downtown", ...HOME },
  goldenGate: {
    label: "Golden Gate Bridge",
    center: [-122.4783, 37.8199],
    zoom: 14.2,
    pitch: 62,
    bearing: -35,
  },
  waterfront: {
    label: "Ferry Building",
    center: [-122.3933, 37.7955],
    zoom: 16.1,
    pitch: 62,
    bearing: -62,
  },
  coit: {
    label: "Coit Tower",
    center: [-122.4058, 37.8024],
    zoom: 16.0,
    pitch: 65,
    bearing: -25,
  },
  paintedLadies: {
    label: "Painted Ladies",
    center: [-122.4329, 37.7762],
    zoom: 17.0,
    pitch: 58,
    bearing: 35,
  },
  park: {
    label: "Golden Gate Park",
    center: [-122.4693, 37.7694],
    zoom: 14.2,
    pitch: 52,
    bearing: -65,
  },
  twinPeaks: {
    label: "Twin Peaks",
    center: [-122.4475, 37.7544],
    zoom: 14.5,
    pitch: 65,
    bearing: 35,
  },
  city: {
    label: "Whole city",
    center: [-122.441, 37.774],
    zoom: 12.5,
    pitch: 45,
    bearing: -15,
  },
};
// Preserve the original world coordinates and saves; the active simulation is
// located in the downtown district, at 12 metres per original world unit.
export function citizenLngLat(a) {
  return [-122.403 + (a.x * 12) / 87900, 37.793 - (a.z * 12) / 111320];
}
export function validMapCamera(c) {
  return (
    c &&
    Array.isArray(c.center) &&
    c.center.length === 2 &&
    c.center.every(Number.isFinite) &&
    c.center[0] >= -123 &&
    c.center[0] <= -122 &&
    c.center[1] >= 37 &&
    c.center[1] <= 39 &&
    Number.isFinite(c.zoom) &&
    c.zoom >= 10 &&
    c.zoom <= 20 &&
    Number.isFinite(c.pitch) &&
    c.pitch >= 0 &&
    c.pitch <= 75 &&
    Number.isFinite(c.bearing) &&
    Math.abs(c.bearing) <= 360
  );
}
