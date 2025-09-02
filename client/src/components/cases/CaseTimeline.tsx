import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Mail, MessageCircle, UploadCloud } from 'lucide-react';
import { useState } from 'react';

type EventType = 'upload' | 'draft' | 'message' | 'email';

type CaseEvent = {
  id: string;
  type: EventType;
  title: string;
  user: string;
  timestamp: string;
  details?: string;
};

async function fetchEvents(caseId: string): Promise<{ events: CaseEvent[] }> {
  const res = await fetch(`/api/cases/${caseId}/events`);
  if (!res.ok) throw new Error('Failed to load events');
  return res.json();
}

function iconForType(t: EventType) {
  switch (t) {
    case 'upload':
      return <UploadCloud className="w-5 h-5" />;
    case 'draft':
      return <FileText className="w-5 h-5" />;
    case 'email':
      return <Mail className="w-5 h-5" />;
    default:
      return <MessageCircle className="w-5 h-5" />;
  }
}

export function CaseTimeline({ caseId }: { caseId: string }) {
  const [filter, setFilter] = useState<EventType | 'all'>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['case-events', caseId],
    queryFn: () => fetchEvents(caseId),
    enabled: !!caseId,
    staleTime: 1000 * 20,
  });

  const events: CaseEvent[] = (data?.events ?? []).sort(
    (a: CaseEvent, b: CaseEvent) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const filtered = events.filter((e) => (filter === 'all' ? true : e.type === filter));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Case Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Button
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'upload' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('upload')}
          >
            Uploads
          </Button>
          <Button
            variant={filter === 'draft' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('draft')}
          >
            Drafts
          </Button>
          <Button
            variant={filter === 'message' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('message')}
          >
            Notes
          </Button>
          <Button
            variant={filter === 'email' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('email')}
          >
            Emails
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-12 bg-slate-100 animate-pulse rounded" />
            <div className="h-12 bg-slate-100 animate-pulse rounded" />
            <div className="h-12 bg-slate-100 animate-pulse rounded" />
          </div>
        ) : error ? (
          <div className="text-red-600">Failed to load timeline</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">No events for this case yet.</div>
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-slate-200" />
            <AnimatePresence>
              {filtered.map((ev) => (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 relative"
                >
                  <div className="absolute -left-3 top-1 bg-white rounded-full border p-1">
                    {iconForType(ev.type)}
                  </div>
                  <div className="ml-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{ev.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(ev.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">By {ev.user}</div>
                    <details className="mt-2">
                      <summary className="text-xs text-blue-600 cursor-pointer">Details</summary>
                      <div className="mt-2 text-sm text-slate-700">{ev.details}</div>
                    </details>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CaseTimeline;
