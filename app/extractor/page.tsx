import { LeadExtractor } from '@/components/LeadExtractor';

export default function ExtractorPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-display font-bold mb-2">Advanced Engine</h1>
        <p className="text-slate-400 mb-8">No API limits. Deep social & SEO extraction.</p>
        <LeadExtractor />
      </div>
    </div>
  );
}
