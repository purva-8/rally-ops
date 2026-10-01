import { redirect } from 'next/navigation';

// The tournaments list is the front door: anyone can browse it, and sign-in is asked for when they register.
export default function Home() {
  redirect('/events');
}
