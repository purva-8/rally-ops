import Link from 'next/link';

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/rallyops" className="text-sm text-orange-600 hover:text-orange-700 font-medium mb-8 inline-block">← Back</Link>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-6">Support</h1>
        <div className="space-y-5 text-slate-600 text-sm leading-relaxed">
          <p>Need help setting up a tournament, registering, or fixing an issue with your account? Reach out and we'll help you out.</p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mt-6">
            <p className="text-slate-900 font-semibold text-sm mb-1">Email</p>
            <a href="mailto:purvahk08@gmail.com" className="text-orange-600 hover:text-orange-700 text-sm">purvahk08@gmail.com</a>
          </div>
        </div>
      </div>
    </div>
  );
}
