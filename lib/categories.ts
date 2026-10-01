// Single source of truth for tournament categories: label, who can enter, and whether a partner is needed.
// Age limits are inclusive and measured on the tournament date.

export type CategoryDef = {
  label: string;
  genders?: ('male' | 'female')[];
  minAge?: number;
  maxAge?: number;
  doubles?: boolean;
  // Entry fee for this category; falls back to the tournament's entry_fee
  fee?: number;
};

export const CATEGORY_DEFS: Record<string, CategoryDef> = {
  // Classic categories
  male_singles:   { label: 'Male Singles',   genders: ['male'] },
  female_singles: { label: 'Female Singles', genders: ['female'] },
  male_doubles:   { label: 'Male Doubles',   genders: ['male'], doubles: true },
  female_doubles: { label: 'Female Doubles', genders: ['female'], doubles: true },
  spouse_doubles: { label: 'Spouse Doubles', doubles: true },
  mixed_doubles:  { label: 'Mixed Doubles',  doubles: true },
  boys_u13:  { label: 'Boys U13',  genders: ['male'],   maxAge: 13 },
  boys_u15:  { label: 'Boys U15',  genders: ['male'],   maxAge: 15 },
  boys_u18:  { label: 'Boys U18',  genders: ['male'],   maxAge: 18 },
  girls_u13: { label: 'Girls U13', genders: ['female'], maxAge: 13 },
  girls_u15: { label: 'Girls U15', genders: ['female'], maxAge: 15 },
  girls_u18: { label: 'Girls U18', genders: ['female'], maxAge: 18 },

  // Age-banded categories (Kids 10-14, Youth over 14 up to 18, Adults 18+)
  female_singles_18plus:  { label: 'Singles - Female (18+)',           genders: ['female'], minAge: 18, fee: 30 },
  female_singles_kids:    { label: 'Singles - Female (Kids 10-14)',    genders: ['female'], minAge: 10, maxAge: 14, fee: 30 },
  female_singles_youth:   { label: 'Singles - Female (Youth 14-18)',   genders: ['female'], minAge: 15, maxAge: 18, fee: 30 },
  male_singles_18plus:    { label: 'Singles - Male (18+)',             genders: ['male'],   minAge: 18, fee: 35 },
  male_singles_kids:      { label: 'Singles - Male (Kids 10-14)',      genders: ['male'],   minAge: 10, maxAge: 14, fee: 30 },
  male_singles_youth:     { label: 'Singles - Male (Youth 14-18)',     genders: ['male'],   minAge: 15, maxAge: 18, fee: 30 },
  male_doubles_18plus:    { label: "Doubles - Men's Open (18+)",       genders: ['male'],   minAge: 18, doubles: true, fee: 60 },
  mixed_doubles_kids:     { label: 'Doubles - Mixed Open (Kids 10-14)',  minAge: 10, maxAge: 14, doubles: true, fee: 60 },
  mixed_doubles_youth:    { label: 'Doubles - Mixed Open (Youth 14-18)', minAge: 15, maxAge: 18, doubles: true, fee: 60 },
  // Adults only: kids and youth play in their own bands
  mixed_doubles_open:     { label: 'Doubles - Mixed Open',             minAge: 18, doubles: true, fee: 60 },
  spouse_doubles_open:    { label: 'Doubles - Spouse',                 minAge: 18, doubles: true, fee: 60 },
  female_doubles_open:    { label: 'Doubles - Women',                  genders: ['female'], minAge: 18, doubles: true, fee: 60 },

  // Under 10 (7-10), any gender
  singles_u10:            { label: 'Singles - Kids U10 (7-10)',        minAge: 7, maxAge: 10, fee: 30 },
  doubles_u10:            { label: 'Doubles - Kids U10 (7-10)',        minAge: 7, maxAge: 10, doubles: true, fee: 60 },
};

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_DEFS).map(([id, d]) => [id, d.label]),
);

export function categoryLabel(id: string) {
  return CATEGORY_LABELS[id] ?? id.replace(/_/g, ' ');
}

export function isDoublesCategory(id: string) {
  return CATEGORY_DEFS[id]?.doubles ?? false;
}

export function ageOn(dob: string, onDate: string) {
  const birth = new Date(dob);
  const ref = new Date(onDate);
  let age = ref.getFullYear() - birth.getFullYear();
  const hadBirthday = ref.getMonth() > birth.getMonth() || (ref.getMonth() === birth.getMonth() && ref.getDate() >= birth.getDate());
  if (!hadBirthday) age--;
  return age;
}

export function isEligible(id: string, gender: string | null, dob: string | null, eventDate: string) {
  const def = CATEGORY_DEFS[id];
  if (!def) return true;
  if (def.genders && !(gender && def.genders.includes(gender as 'male' | 'female'))) return false;
  if ((def.minAge !== undefined || def.maxAge !== undefined) && dob) {
    const age = ageOn(dob, eventDate);
    if (def.minAge !== undefined && age < def.minAge) return false;
    if (def.maxAge !== undefined && age > def.maxAge) return false;
  }
  return true;
}

export type PartnerInfo = {
  gender?: string | null;
  dob?: string | null;
  age?: number | null;
  relationship?: string | null;
  isAccountHolder?: boolean;
  sameHousehold?: boolean;
};

// Why this person cannot be the partner in this doubles category, or null when it is fine.
// Anything unknown (a typed name, a missing birth date) is allowed through; the organizers check it later.
export function partnerIssue(id: string, me: PartnerInfo, partner: PartnerInfo, eventDate: string): string | null {
  const def = CATEGORY_DEFS[id];
  if (!def?.doubles) return null;
  const ageOf = (p: PartnerInfo) => p.age ?? (p.dob ? ageOn(p.dob, eventDate) : null);
  const age = ageOf(partner);
  if (def.genders && partner.gender && !def.genders.includes(partner.gender as 'male' | 'female')) {
    return def.genders[0] === 'male' ? 'This category is for men only' : 'This category is for women only';
  }
  if (age !== null && def.minAge !== undefined && age < def.minAge) return `Partner must be ${def.minAge} or older`;
  if (age !== null && def.maxAge !== undefined && age > def.maxAge) return `Partner must be ${def.maxAge} or younger`;
  if (id.startsWith('mixed') && me.gender && partner.gender && me.gender === partner.gender) {
    return 'Mixed doubles needs one man and one woman';
  }
  if (id === 'spouse_doubles_open' && partner.sameHousehold) {
    const married = (me.isAccountHolder && partner.relationship === 'spouse') || (partner.isAccountHolder && me.relationship === 'spouse');
    if (!married) return 'Spouse doubles is for husband and wife';
  }
  return null;
}

export function categoryFee(id: string, fallback: number) {
  return CATEGORY_DEFS[id]?.fee ?? fallback;
}

// Doubles entries show as "Player / Partner" in brackets and fixtures
export function entryLabel(fullName: string, partnerName: string | undefined | null, category: string) {
  return isDoublesCategory(category) && partnerName ? `${fullName} / ${partnerName}` : fullName;
}

// The flag is what organizers set, but any tournament named Samanvayam counts too so a missed tick can't hide family registration
export function isSamanvayamTournament(t: { is_samanvayam?: boolean | null; name?: string | null }) {
  return !!t.is_samanvayam || /samanvay/i.test(t.name ?? '');
}

// Cheapest entry across a tournament's categories, for "from QAR 30" labels
export function startingFee(categories: string[] | null | undefined, fallback: number) {
  const fees = (categories ?? []).map((c) => categoryFee(c, fallback));
  return fees.length ? Math.min(...fees) : fallback;
}

export function feeLabel(categories: string[] | null | undefined, fallback: number) {
  const fees = (categories ?? []).map((c) => categoryFee(c, fallback));
  const min = fees.length ? Math.min(...fees) : fallback;
  if (!min) return 'Free';
  const varies = fees.some((f) => f !== min);
  return `${varies ? 'From ' : ''}QAR ${min}`;
}
