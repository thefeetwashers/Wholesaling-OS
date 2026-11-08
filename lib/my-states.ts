import { supabase, supabaseConfigured } from './supabase';

// Slice 96 — My States. The wholesaler's saved working states,
// on their own profile row (schema v5.5). The list sets
// defaults — the Auction Feed opens on the first saved state —
// and never limits anything: coverage is the whole country for
// every account, saved states or not.

export const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
  { code: 'PR', name: 'Puerto Rico' }, { code: 'GU', name: 'Guam' }, { code: 'VI', name: 'U.S. Virgin Islands' },
  { code: 'AS', name: 'American Samoa' }, { code: 'MP', name: 'Northern Mariana Islands' },
];

const CODE_SET = new Set(US_STATES.map((s) => s.code));

export function validStateCodes(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const picked = new Set<string>();
  for (const v of input) {
    const code = typeof v === 'string' ? v.toUpperCase() : '';
    if (CODE_SET.has(code)) picked.add(code);
  }
  // Deterministic order: the canonical list order, so "first
  // saved state" means the same thing on every read.
  return US_STATES.map((s) => s.code).filter((c) => picked.has(c));
}

export async function loadMyStates(userId: string): Promise<string[]> {
  if (!supabaseConfigured || !supabase || !userId) return [];
  const { data, error } = await supabase.from('profiles').select('my_states').eq('id', userId).single();
  if (error || !data) return [];
  return validStateCodes((data as { my_states?: unknown }).my_states);
}

export async function saveMyStates(userId: string, codes: string[]): Promise<boolean> {
  if (!supabaseConfigured || !supabase || !userId) return false;
  const clean = validStateCodes(codes);
  const { error } = await supabase.from('profiles').update({ my_states: clean }).eq('id', userId);
  return !error;
}
