import { formatDate } from '@/lib/format';

// Online registration ends at registration_close_at even while the event's status is still "open"
// (the database refuses new entries after it too). Organizers still add on-the-spot entries by hand.
export function registrationClosed(t: { status: string; registration_close_at?: string | null }) {
  return t.status === 'open' && !!t.registration_close_at && Date.now() > new Date(t.registration_close_at).getTime();
}

// Last time on the event day that on-the-spot entries are taken (play starts at 4 PM)
export const ON_SPOT_CUTOFF = '4:00 PM';

// Shown in place of the Register button, so people see it without tapping anything
export function RegistrationClosedMessage({ eventDate, size = 'md' }: { eventDate?: string | null; size?: 'sm' | 'md' }) {
  const day = formatDate(eventDate);
  return (
    <div className={`w-full bg-amber-50 border border-amber-300 text-left ${size === 'sm' ? 'rounded-xl px-3 py-2.5' : 'rounded-2xl px-4 py-3.5 shadow-xl'}`}>
      <p className={`font-bold text-amber-900 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>⏰ Online registration is closed</p>
      <p className={`text-amber-900/80 mt-0.5 leading-snug ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
        You can still register <strong>on the spot</strong> at the venue{day ? <> on <strong>{day}</strong></> : ''},
        {' '}<strong>strictly before {ON_SPOT_CUTOFF}</strong>.
      </p>
    </div>
  );
}
