import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/rallyops" className="text-sm text-orange-600 hover:text-orange-700 font-medium mb-8 inline-block">← Back</Link>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-6">Privacy Policy</h1>
        <div className="space-y-5 text-slate-600 text-sm leading-relaxed">
          <p>RallyOps collects the information you provide when creating an account and registering for tournaments: your name, email, mobile number, gender, and date of birth. Organizers see the registration details of players who sign up for their events.</p>
          <p>We use this information solely to run tournaments: managing registrations, generating brackets, scoring matches, and sending you match updates.</p>
          <p>We do not sell your data to third parties. Data is stored securely with our database provider and is only accessible to you and the organizers of tournaments you register for.</p>
          <p>You can request deletion of your account and associated data at any time by contacting support.</p>
        </div>
      </div>
    </div>
  );
}
