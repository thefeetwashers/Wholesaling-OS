import type { Lead } from './leads';

// Slice 86 — the driving-for-dollars route board's link math.
// Plain google.com/maps directions URLs: no API key, no embedded
// map, no tracking — the links open Google Maps on the
// wholesaler's own phone, under their own Google account. The
// platform builds the link from addresses the wholesaler already
// has in their own leads and never sees the trip itself.

export function leadAddress(l: Lead): string {
  return [l.property_address, l.city, l.state, l.zip].filter((x) => x && String(x).trim()).join(', ');
}

export function stopUrl(l: Lead): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(leadAddress(l))}`;
}

export function routeUrl(stops: Lead[]): string {
  if (stops.length === 0) return '';
  if (stops.length === 1) return stopUrl(stops[0]);
  const origin = encodeURIComponent(leadAddress(stops[0]));
  const destination = encodeURIComponent(leadAddress(stops[stops.length - 1]));
  const middle = stops.slice(1, -1).map(leadAddress).join('|');
  const waypoints = middle ? `&waypoints=${encodeURIComponent(middle)}` : '';
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints}`;
}
