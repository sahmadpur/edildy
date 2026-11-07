import type { ProblemMediaRef } from '@taskop/contracts';
import { useMemo, useState } from 'react';
import { MediaLightbox, MediaThumb, MediaUrlSourceProvider, type ViewableMedia } from '@/features/executions/media';
import type { MediaUrlSource } from '@/features/executions/queries';
import { REPORT_MEDIA_SOURCE, taskReportMediaSource } from './queries';

function Strip({ media, source }: { media: ProblemMediaRef[]; source: MediaUrlSource }) {
  const [open, setOpen] = useState<ViewableMedia | null>(null);
  if (!media.length) return null;
  return (
    <MediaUrlSourceProvider source={source}>
      <div className="flex flex-wrap gap-2">
        {media.map((m) => (
          <MediaThumb key={m.id} media={{ ...m, durationMs: null }} onOpen={setOpen} />
        ))}
      </div>
      {open && <MediaLightbox media={open} onClose={() => setOpen(null)} />}
    </MediaUrlSourceProvider>
  );
}

/** A report's media on the reports tab, signed through the report. */
export const ReportMediaStrip = ({ media }: { media: ProblemMediaRef[] }) => <Strip media={media} source={REPORT_MEDIA_SOURCE} />;

/** The source report's media on a task, signed through the task (2026-11-06 design §6.2). */
export function TaskReportMediaStrip({ taskId, media }: { taskId: string; media: ProblemMediaRef[] }) {
  const source = useMemo(() => taskReportMediaSource(taskId), [taskId]);
  return <Strip media={media} source={source} />;
}
