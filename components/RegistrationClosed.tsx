'use client';

import { formatDate } from '@/lib/format';

// Online registration ends at registration_close_at even while the event's status is still "open"
// (the database refuses new entries after it too). Organizers still add on-the-spot entries by hand.
export function registrationClosed(t: { status: string; registration_close_at?: string | null }) {
  return t.status === 'open' && !!t.registration_close_at && Date.now() > new Date(t.registration_close_at).getTime();
}

// Last time on the event day that on-the-spot entries are taken (play starts at 4 PM)
export const ON_SPOT_CUTOFF = '4:00 PM';

export function RegistrationClosedNotice({ eventDate, onClose }: { eventDate?: string | null; onClose: () => void }) {
  const day = formatDate(eventDate);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="reg-closed-title"
        className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl mb-4">⏰</div>
        <h2 id="reg-closed-title" className="text-lg font-bold text-stone-900 mb-2">Online registration is closed</h2>
        <p className="text-sm text-stone-600 leading-relaxed">
          You can still register <strong>on the spot</strong> at the venue{day ? <> on <strong>{day}</strong></> : ''},
          {' '}<strong>strictly before {ON_SPOT_CUTOFF}</strong>.
        </p>
        <button onClick={onClose}
          className="mt-5 w-full bg-[#111827] hover:bg-[#1F2937] text-white py-3 rounded-xl font-semibold text-sm">
          OK
        </button>
      </div>
    </div>
  );
}
