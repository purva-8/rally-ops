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
  mixed_doubles_open:     { label: 'Doubles - Mixed Open',             doubles: true, fee: 60 },
  spouse_doubles_open:    { label: 'Doubles - Spouse',                 doubles: true, fee: 60 },
  female_doubles_open:    { label: 'Doubles - Women',                  genders: ['female'], doubles: true, fee: 60 },
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

export function categoryFee(id: string, fallback: number) {
  return CATEGORY_DEFS[id]?.fee ?? fallback;
}

// Doubles entries show as "Player / Partner" in brackets and fixtures
export function entryLabel(fullName: string, partnerName: string | undefined | null, category: string) {
  return isDoublesCategory(category) && partnerName ? `${fullName} / ${partnerName}` : fullName;
}
