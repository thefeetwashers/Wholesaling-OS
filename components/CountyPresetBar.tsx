// Slice 129 — County Preset Bar.
//
// A dropdown of the seven Florida county presets (lib/
// floridaCountyPresets.ts) plus the two portal links and the clerk
// filter cheat-sheet for the selected county. Drop it below the
// upload header on the Probate Leads desk and above the distress
// importer on the County Desk.
//
// The checkbox lists are UNVERIFIED (see the presets file) — the bar
// labels them "Clerk filters — confirm on the clerk site" and never
// presents them as exact. Every URL in the presets was verified live
// Nov 16, 2026; a county whose link could not be verified would show
// plain text instead of a link (none is unverified today).

import { FLORIDA_COUNTY_PRESETS, type FloridaCountyPreset } from '../lib/floridaCountyPresets';

export default function CountyPresetBar({
  selectedCounty,
  onSelectCounty,
}: {
  selectedCounty: FloridaCountyPreset;
  onSelectCounty: (preset: FloridaCountyPreset) => void;
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 20 }}>📍</span>
          <div>
            <label htmlFor="county-preset" style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b' }}>
              Active county preset
            </label>
            <select
              id="county-preset"
              value={selectedCounty.id}
              onChange={(e) => {
                const found = FLORIDA_COUNTY_PRESETS.find((c) => c.id === e.target.value);
                if (found) onSelectCounty(found);
              }}
              style={{ fontSize: 14, fontWeight: 700, border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 0' }}
            >
              {FLORIDA_COUNTY_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a
            href={selectedCounty.clerkSearchUrl}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#0f172a', textDecoration: 'none' }}
          >
            Open {selectedCounty.clerkPortalName} ↗
          </a>
          <a
            href={selectedCounty.propertyAppraiserUrl}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', textDecoration: 'none' }}
          >
            Open {selectedCounty.propertyAppraiserName} ↗
          </a>
        </div>
      </div>
      <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 10, paddingTop: 10, fontSize: 12 }}>
        <span style={{ fontWeight: 700 }}>
          Clerk filters ({selectedCounty.courtTypeFilter}) — confirm on the clerk site:
        </span>{' '}
        {selectedCounty.probateCaseCheckboxes.map((box) => (
          <span
            key={box}
            style={{ display: 'inline-block', fontSize: 11, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 999, padding: '2px 8px', margin: '2px 4px 2px 0' }}
          >
            ✓ {box}
          </span>
        ))}
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>{selectedCounty.verificationNote}</div>
      </div>
    </div>
  );
}
