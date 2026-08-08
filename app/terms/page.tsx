import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/rallyops" className="text-sm text-orange-600 hover:text-orange-700 font-medium mb-8 inline-block">← Back</Link>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-6">Terms of Service</h1>
        <div className="space-y-5 text-slate-600 text-sm leading-relaxed">
          <p>By using RallyOps, you agree to provide accurate registration information and to follow the rules and eligibility criteria set by tournament organizers.</p>
          <p>Organizers are responsible for the tournaments they create, including entry fees, rules, and match scheduling. RallyOps provides the platform but is not a party to any agreement between organizers and players.</p>
          <p>RallyOps is provided as-is, free of charge. We may update or change features at any time to improve the service.</p>
          <p>Misuse of the platform — including fraudulent registrations or abuse of other users — may result in account suspension.</p>
        </div>
      </div>
    </div>
  );
}
