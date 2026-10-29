// Script/message templates ported verbatim from the user's own prototype
// snapshot (TEMPLATES in WholesalingOS.html, extracted Oct 29, 2026).
// Merge fields: {name} {you} {biz} {city} {address}.
export interface ScriptTemplate { key: string; label: string; body: string; }
export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  { key: "intro", label: "Intro \u2014 cold outreach", body: "Hi {name}, my name is {you}. I'm interested in purchasing a property in the area and wanted to see whether you would consider an offer on {address}. Is that something you'd be open to talking about?" },
  { key: "code", label: "Code violation", body: "Hi {name}, my name is {you} with {biz}. I work with property owners in {city} who are dealing with code issues and repair headaches \u2014 I buy houses as-is for cash, and the violations become my problem, not yours. Would you consider an offer on {address}?" },
  { key: "probate", label: "Probate", body: "Hi {name}, my name is {you}. I understand your family may have recently inherited the property at {address}, and I want to start by saying I'm sorry for your loss. When the time is right, I help families sell inherited homes as-is \u2014 no cleanouts, no repairs. No pressure at all; I'm here whenever it's useful." },
  { key: "landlord", label: "Tired landlord", body: "Hi {name}, my name is {you}. I buy rental properties in {city} directly from landlords \u2014 tenants, repairs, and all. If you've ever thought about being done with {address}, I'd like to make you a cash offer so you can compare. Worth a quick conversation?" },
  { key: "fsbo", label: "FSBO (for sale by owner)", body: "Hi {name}, my name is {you}. I saw your home at {address} listed for sale by owner. I buy homes for cash in the area \u2014 no agent commissions, you pick the closing date, and I buy as-is. Would you consider a cash offer alongside your listing?" },
  { key: "drip3", label: "Follow-up drip \u2014 day 3", body: "Hi {name}, {you} again \u2014 just circling back on {address}. My cash offer still stands, as-is, and you pick the closing date. Even a ballpark of what you'd need could help me sharpen the number. What works for you?" },
  { key: "drip7", label: "Follow-up drip \u2014 day 7 (last touch)", body: "Hi {name}, last note from me for a while on {address}. If the timing isn't right, no hard feelings \u2014 but if anything changes (repairs, tenants, taxes), I can close fast and as-is. Just reply to this message anytime. \u2014 {you}" },
  { key: "realtor", label: "Realtor outreach", body: "Hi, this is {you} with {biz}. I work with cash buyers actively looking in your market. When you run into listings that are too distressed, too fast, or won't qualify for financing, I can often get them closed and keep you whole on the referral side where your brokerage allows. Can I send you my buy box?" },
];

export function mergeTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(name|you|biz|city|address)\}/g, (m, k) => vars[k] || m);
}
