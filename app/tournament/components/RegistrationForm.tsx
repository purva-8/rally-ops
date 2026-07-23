'use client';

import { useState } from 'react';
import { useTournamentStore } from '../store';
import type { Category, Gender } from '../types';
import { CATEGORY_LABELS } from '../types';

const DOUBLES_CATS: Category[] = ['male_doubles', 'female_doubles', 'spouse_doubles'];

interface ParticipantForm {
  fullName: string;
  mobile: string;
  email: string;
  gender: Gender | '';
  dob: string;
  emergencyContact: string;
  categories: Category[];
  partnerName: string;
}

const emptyForm = (): ParticipantForm => ({
  fullName: '', mobile: '', email: '', gender: '', dob: '',
  emergencyContact: '', categories: [], partnerName: '',
});

interface Props {
  onSuccess: (regId: string, name: string) => void;
}

export default function RegistrationForm({ onSuccess }: Props) {
  const addParticipant = useTournamentStore((s) => s.addParticipant);
  const selectedCategories = useTournamentStore((s) => s.selectedCategories);
  const CATEGORIES = selectedCategories.length > 0 ? selectedCategories : (['male_singles', 'female_singles', 'male_doubles', 'female_doubles', 'spouse_doubles'] as Category[]);
  const [regType, setRegType] = useState<'individual' | 'family'>('individual');
  const [forms, setForms] = useState<ParticipantForm[]>([emptyForm()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const update = (i: number, field: keyof ParticipantForm, value: unknown) => {
    setForms((prev) => prev.map((f, idx) => idx === i ? { ...f, [field]: value } : f));
    setErrors((prev) => { const e = { ...prev }; delete e[`${i}.${field}`]; return e; });
  };

  const toggleCategory = (i: number, cat: Category) => {
    setForms((prev) =>
      prev.map((f, idx) => {
        if (idx !== i) return f;
        const cats = f.categories.includes(cat)
          ? f.categories.filter((c) => c !== cat)
          : [...f.categories, cat];
        return { ...f, categories: cats };
      })
    );
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    forms.forEach((f, i) => {
      if (!f.fullName.trim()) errs[`${i}.fullName`] = 'Required';
      if (!f.mobile.trim() || !/^\d{10}$/.test(f.mobile)) errs[`${i}.mobile`] = 'Valid 10-digit number required';
      if (!f.email.trim() || !/\S+@\S+\.\S+/.test(f.email)) errs[`${i}.email`] = 'Valid email required';
      if (!f.gender) errs[`${i}.gender`] = 'Required';
      if (!f.dob) errs[`${i}.dob`] = 'Required';
      if (!f.emergencyContact.trim()) errs[`${i}.emergencyContact`] = 'Required';
      if (f.categories.length === 0) errs[`${i}.categories`] = 'Select at least one category';
      const hasDoubles = f.categories.some((c) => DOUBLES_CATS.includes(c));
      if (hasDoubles && !f.partnerName.trim()) errs[`${i}.partnerName`] = 'Partner name required for doubles';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    let lastRegId = '';
    let lastName = '';
    for (const f of forms) {
      const p = addParticipant({
        fullName: f.fullName,
        mobile: f.mobile,
        email: f.email,
        gender: f.gender as Gender,
        dob: f.dob,
        emergencyContact: f.emergencyContact,
        categories: f.categories,
        partnerName: f.partnerName || undefined,
      });
      lastRegId = p.registrationId;
      lastName = p.fullName;
    }

    setSubmitting(false);
    onSuccess(lastRegId, lastName);
  };

  const err = (key: string) => errors[key] ? (
    <p className="text-red-500 text-xs mt-1">{errors[key]}</p>
  ) : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-20 lg:pb-6">
      {/* Registration type */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-orange-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Registration Type</h3>
        <div className="flex gap-4">
          {(['individual', 'family'] as const).map((t) => (
            <label key={t} className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border-2 transition-colors ${
              regType === t ? 'border-orange-600 bg-orange-50 text-orange-800' : 'border-gray-200 text-gray-600'
            }`}>
              <input type="radio" name="regType" value={t} checked={regType === t}
                onChange={() => {
                  setRegType(t);
                  setForms(t === 'individual' ? [emptyForm()] : [emptyForm(), emptyForm()]);
                }}
                className="sr-only"
              />
              <span className="text-lg">{t === 'individual' ? '👤' : '👨‍👩‍👧'}</span>
              <span className="font-medium capitalize">{t} Registration</span>
            </label>
          ))}
        </div>
      </div>

      {/* Participant forms */}
      {forms.map((form, i) => (
        <div key={i} className="bg-white rounded-2xl shadow-md p-6 border border-orange-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">
              {regType === 'family' ? `Participant ${i + 1}` : 'Participant Details'}
            </h3>
            {regType === 'family' && forms.length > 1 && (
              <button type="button" onClick={() => setForms((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-red-500 text-sm hover:text-red-700">Remove</button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input type="text" value={form.fullName} onChange={(e) => update(i, 'fullName', e.target.value)}
                placeholder="Enter full name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              {err(`${i}.fullName`)}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
              <input type="tel" value={form.mobile} onChange={(e) => update(i, 'mobile', e.target.value)}
                placeholder="10-digit number"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              {err(`${i}.mobile`)}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={(e) => update(i, 'email', e.target.value)}
                placeholder="email@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              {err(`${i}.email`)}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
              <select value={form.gender} onChange={(e) => update(i, 'gender', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              {err(`${i}.gender`)}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
              <input type="date" value={form.dob} onChange={(e) => update(i, 'dob', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              {err(`${i}.dob`)}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact *</label>
              <input type="text" value={form.emergencyContact} onChange={(e) => update(i, 'emergencyContact', e.target.value)}
                placeholder="Name and phone number"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              {err(`${i}.emergencyContact`)}
            </div>
          </div>

          {/* Categories */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Categories * <span className="text-gray-400 font-normal">(select all that apply)</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <label key={cat} className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border transition-colors ${
                  form.categories.includes(cat) ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                  <input type="checkbox" checked={form.categories.includes(cat)}
                    onChange={() => toggleCategory(i, cat)} className="sr-only" />
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-xs ${
                    form.categories.includes(cat) ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-300'
                  }`}>
                    {form.categories.includes(cat) && '✓'}
                  </span>
                  <span className="text-sm">{CATEGORY_LABELS[cat]}</span>
                </label>
              ))}
            </div>
            {err(`${i}.categories`)}
          </div>

          {/* Partner name for doubles */}
          {form.categories.some((c) => DOUBLES_CATS.includes(c)) && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Doubles Partner Name *</label>
              <input type="text" value={form.partnerName} onChange={(e) => update(i, 'partnerName', e.target.value)}
                placeholder="Enter your partner's full name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              {err(`${i}.partnerName`)}
            </div>
          )}
        </div>
      ))}

      {/* Add family member */}
      {regType === 'family' && (
        <button type="button" onClick={() => setForms((prev) => [...prev, emptyForm()])}
          className="w-full border-2 border-dashed border-orange-300 rounded-2xl py-3 text-orange-700 font-medium hover:border-orange-500 hover:bg-orange-50 transition-colors">
          + Add Family Member
        </button>
      )}

      <button type="submit" disabled={submitting}
        className="w-full bg-orange-700 text-white py-3 rounded-xl font-semibold text-base hover:bg-orange-800 disabled:opacity-60 transition-colors shadow-md">
        {submitting ? 'Registering...' : '🏸 Submit Registration'}
      </button>
    </form>
  );
}
