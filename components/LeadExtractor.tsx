'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';

interface Lead {
  title: string;
  url: string;
  emails: string[];
  socials: {
    facebook: string;
    instagram: string;
    linkedin: string;
    twitter: string;
  };
  seoScore: number | null;
  pageSpeedScore: number | null;
}

export function LeadExtractor() {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [scrapedEmpty, setScrapedEmpty] = useState(false);

  const handleExtract = async (provider: 'local' | 'apify' = 'local') => {
    if (!query) {
      toast.error('Please enter a business type or niche.');
      return;
    }

    setIsExtracting(true);
    setLeads([]);
    setScrapedEmpty(false);
    toast('Extraction started. This might take a minute...');

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, location, provider }),
      });

      const data = await res.json();

      if (data.success) {
        if (!data.data || data.data.length === 0) {
          setScrapedEmpty(true);
          toast.error("0 leads found using local search.");
        } else {
          setLeads(data.data);
          toast.success(`Successfully extracted ${data.data.length} advanced leads!`);
        }
      } else {
        toast.error(`Extraction failed: ${data.error}`);
      }
    } catch (err) {
      toast.error('Failed to connect to extraction engine.');
    } finally {
      setIsExtracting(false);
    }
  };

  const downloadCSV = () => {
    if (leads.length === 0) return;

    const headers = ['Business Name', 'Website', 'Emails', 'Facebook', 'Instagram', 'LinkedIn', 'SEO Score', 'Performance Score'];
    const rows = leads.map(l => [
      l.title,
      l.url,
      l.emails.join(' | '),
      l.socials.facebook,
      l.socials.instagram,
      l.socials.linkedin,
      l.seoScore || 'N/A',
      l.pageSpeedScore || 'N/A'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + '\n' 
      + rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `extracted_leads_${query}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto mt-8 border-slate-800 bg-slate-900/50 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-2xl text-primary font-bold flex items-center gap-2">
          <Search className="w-6 h-6" />
          Advanced Lead Extraction Engine
        </CardTitle>
        <CardDescription className="text-slate-400">
          Search Google, extract websites, find emails, social links, and check SEO scores instantly. (Zero API Cost)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <Input 
            placeholder="e.g. Dentists, Gyms, Marketing Agencies" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-slate-950 border-slate-700 text-white"
          />
          <Input 
            placeholder="Location (e.g. Mumbai, New York)" 
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="flex-1 bg-slate-950 border-slate-700 text-white"
          />
          <Button 
            onClick={() => handleExtract('local')} 
            disabled={isExtracting}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
          >
            {isExtracting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
            {isExtracting ? 'Extracting...' : 'Extract'}
          </Button>
        </div>

        {scrapedEmpty && (
          <div className="mb-8 p-4 rounded-md border border-destructive/20 bg-destructive/5 text-center space-y-3 max-w-md mx-auto">
            <p className="text-xs text-slate-400">
              0 leads found using local search. Fall back to Apify API to fetch results.
            </p>
            <Button 
              onClick={() => handleExtract('apify')}
              disabled={isExtracting}
              variant="destructive"
              size="sm"
              className="w-full flex items-center justify-center gap-2 cursor-pointer bg-red-950 hover:bg-red-900 border border-red-800 text-red-200"
            >
              {isExtracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Get leads from Apify
            </Button>
          </div>
        )}

        {leads.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-white">Extracted Leads ({leads.length})</h3>
              <Button onClick={downloadCSV} variant="outline" className="border-slate-700 text-slate-300 hover:text-white">
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
            </div>
            
            <div className="overflow-x-auto rounded-md border border-slate-800">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-400 uppercase bg-slate-950/80">
                  <tr>
                    <th className="px-4 py-3">Business</th>
                    <th className="px-4 py-3">Contact Details</th>
                    <th className="px-4 py-3">Social Links</th>
                    <th className="px-4 py-3">Tech Scores</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, idx) => (
                    <tr key={idx} className="border-b border-slate-800 bg-slate-900/40 hover:bg-slate-800/60">
                      <td className="px-4 py-4 align-top">
                        {(() => {
                          const delimiters = [':', ' - ', ' – ', ' \\| '];
                          let title = lead.title;
                          let subtitle = '';

                          const actualDelimiters = [':', ' - ', ' – ', '|'];
                          for (const delimiter of actualDelimiters) {
                            if (lead.title.includes(delimiter)) {
                              const parts = lead.title.split(delimiter);
                              title = parts[0].trim();
                              subtitle = parts.slice(1).join(delimiter).trim();
                              break;
                            }
                          }

                          if (!subtitle && lead.title.length > 45 && lead.title.includes(',')) {
                            const parts = lead.title.split(',');
                            title = parts[0].trim();
                            subtitle = parts.slice(1).join(',').trim();
                          }

                          return (
                            <div className="flex flex-col gap-0.5 max-w-[200px] sm:max-w-[260px] md:max-w-[300px] overflow-hidden">
                              <a href={lead.url} target="_blank" rel="noreferrer" className="hover:underline text-blue-400 font-semibold leading-tight text-sm break-words">
                                {title}
                              </a>
                              {subtitle && (
                                <div className="text-[10px] text-slate-400 leading-normal italic break-words mt-0.5">
                                  {subtitle}
                                </div>
                              )}
                              <p className="text-[10px] text-slate-500 truncate max-w-[200px] mt-1 font-mono">{lead.url}</p>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-4">
                        {lead.emails.length > 0 ? (
                          lead.emails.map((e, i) => <div key={i} className="text-emerald-400">{e}</div>)
                        ) : (
                          <span className="text-slate-600">No email found</span>
                        )}
                      </td>
                      <td className="px-4 py-4 space-y-1">
                        {lead.socials.facebook && <a href={lead.socials.facebook} target="_blank" rel="noreferrer" className="block text-blue-500 hover:underline">Facebook</a>}
                        {lead.socials.instagram && <a href={lead.socials.instagram} target="_blank" rel="noreferrer" className="block text-pink-500 hover:underline">Instagram</a>}
                        {lead.socials.linkedin && <a href={lead.socials.linkedin} target="_blank" rel="noreferrer" className="block text-blue-600 hover:underline">LinkedIn</a>}
                        {lead.socials.twitter && <a href={lead.socials.twitter} target="_blank" rel="noreferrer" className="block text-sky-400 hover:underline">Twitter</a>}
                        {!Object.values(lead.socials).some(Boolean) && <span className="text-slate-600">None</span>}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1.5">
                          {/* SEO Score Rating */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-mono w-8">SEO:</span>
                            {lead.seoScore !== null ? (
                              (() => {
                                const score = lead.seoScore;
                                let status = "Poor";
                                let bg = "bg-red-500/10 text-red-500 border-red-500/20";
                                if (score >= 80) {
                                  status = "Best";
                                  bg = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
                                } else if (score >= 50) {
                                  status = "Good";
                                  bg = "bg-amber-500/10 text-amber-500 border-amber-500/20";
                                }
                                return (
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${bg}`}>
                                    {score}% · {status}
                                  </span>
                                );
                              })()
                            ) : (
                              <span className="text-[10px] text-slate-600">N/A</span>
                            )}
                          </div>
                          
                          {/* Speed Score Rating */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-mono w-8">SPD:</span>
                            {lead.pageSpeedScore !== null ? (
                              (() => {
                                const score = lead.pageSpeedScore;
                                let status = "Poor";
                                let bg = "bg-red-500/10 text-red-500 border-red-500/20";
                                if (score >= 80) {
                                  status = "Best";
                                  bg = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
                                } else if (score >= 50) {
                                  status = "Good";
                                  bg = "bg-amber-500/10 text-amber-500 border-amber-500/20";
                                }
                                return (
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${bg}`}>
                                    {score}% · {status}
                                  </span>
                                );
                              })()
                            ) : (
                              <span className="text-[10px] text-slate-600">N/A</span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
