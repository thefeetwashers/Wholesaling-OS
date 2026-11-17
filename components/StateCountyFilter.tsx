// Slice 133 — shared state-linked county filter.
//
// One component for every market/state filter in the app: the buy
// box (components/BuyerNetworks.tsx), the /buyers directory
// filters (app/buyers/page.tsx), /vip (app/vip/page.tsx), and the
// deal-blast county filters (components/CashBuyersDealBlast.tsx).
// The Market list follows the selected State: pick CO and the
// dropdown shows Colorado's 64 counties; pick FL and it shows
// Florida's 67; pick several states and it shows the UNION of
// their counties. "All markets" stays the default when nothing
// is picked (empty = no market constraint).
//
// County names come from lib/us-counties.ts — the real U.S.
// Census Bureau 2024 Gazetteer national counties file (public
// domain), never invented. A state with no loaded county list
// shows an honest "counties not loaded yet" note, never fake
// counties. Markets already saved/selected are always kept as
// options even when their state is not currently picked, so
// changing the state never silently drops a saved market — the
// user removes it by deselecting it.
//
// Two modes: multi-select (buy box / VIP / deal blast — several
// states and several markets) and single-select (the /buyers
// directory filters — one state, one market, with an "All
// markets" option). Styling is passed in because the four
// surfaces have different themes (light dashboard vs dark
// public pages).

import { US_STATES, countiesForStates } from '../lib/us-counties';

interface StateCountyFilterProps {
  states: string[];
  onStatesChange: (states: string[]) => void;
  markets: string[];
  onMarketsChange: (markets: string[]) => void;
  /** Single-select state + market (directory filters). Default: multi-select. */
  single?: boolean;
  marketLabel?: string;
  stateLabel?: string;
  /** Text of the empty option in single mode. Default: 'All markets'. */
  marketEmptyLabel?: string;
  inputStyle?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
  hintStyle?: React.CSSProperties;
}

export default function StateCountyFilter({
  states,
  onStatesChange,
  markets,
  onMarketsChange,
  single = false,
  marketLabel = 'Market (county)',
  stateLabel,
  marketEmptyLabel = 'All markets',
  inputStyle,
  labelStyle,
  hintStyle,
}: StateCountyFilterProps) {
  // Union of the picked states' counties, plus any market already
  // selected (a saved market stays visible even if its state is
  // not picked right now — never silently dropped).
  const stateCounties = countiesForStates(states);
  const marketOptions = [...new Set([...stateCounties, ...markets])].sort((a, b) => a.localeCompare(b));
  const noListLoaded = states.length > 0 && stateCounties.length === 0;
  const hint: React.CSSProperties = hintStyle || { fontSize: 12, color: '#cbd5e1' };

  return (
    <>
      <label style={labelStyle}>
        {stateLabel || (single ? 'State' : 'States')}{' '}
        {single ? (
          <select
            value={states[0] || ''}
            onChange={(e) => onStatesChange(e.target.value ? [e.target.value] : [])}
            style={inputStyle}
          >
            <option value="">All states</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <select
            multiple
            value={states}
            onChange={(e) => onStatesChange(Array.from(e.target.selectedOptions, (o) => o.value))}
            style={{ ...inputStyle, height: 110 }}
          >
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <span style={hint}>
          {single
            ? 'Pick a state to narrow the market list to its counties.'
            : 'Hold Ctrl/Cmd to pick several. Empty means no state constraint.'}
        </span>
      </label>
      <label style={labelStyle}>
        {marketLabel}{' '}
        {single ? (
          <select value={markets[0] || ''} onChange={(e) => onMarketsChange(e.target.value ? [e.target.value] : [])} style={inputStyle}>
            <option value="">{marketEmptyLabel}</option>
            {marketOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <select
            multiple
            value={markets}
            onChange={(e) => onMarketsChange(Array.from(e.target.selectedOptions, (o) => o.value))}
            style={{ ...inputStyle, height: 110 }}
          >
            {marketOptions.length === 0 && (
              <option value="" disabled>Select a state to see its counties</option>
            )}
            {marketOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <span style={hint}>
          {noListLoaded
            ? `Counties not loaded yet for ${states.join(', ')} — no counties are shown rather than guessing.`
            : states.length === 0
              ? 'All markets is the default when no state is picked. Pick a state to see its counties.'
              : single
                ? `Counties in ${states.join(', ')}${markets.length > 0 ? '' : ` — pick one, or leave ${marketEmptyLabel}.`}`
                : 'Hold Ctrl/Cmd to pick several. Empty means all markets.'}
        </span>
      </label>
    </>
  );
}
