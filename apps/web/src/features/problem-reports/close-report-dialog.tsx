import { PROBLEM_REPORT_LIMITS, type ProblemReportDto } from '@edildy/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { errorText } from '@/lib/errors';
import { useCloseProblemReport } from './queries';

/** 2026-11-06 design §8: a manager closes a report with a comment (1–1,000 characters) that reaches the reporter. */
export function CloseReportDialog({ report, onClose }: { report: ProblemReportDto; onClose: () => void }) {
  const { t } = useTranslation();
  const close = useCloseProblemReport();
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const text = comment.trim();
    if (!text) {
      setError(t('errors.validation.required'));
      return;
    }
    setError(null);
    try {
      await close.mutateAsync({ id: report.id, body: { comment: text } });
      toast.success(t('executions.reportsTab.closed'));
      onClose();
    } catch (e) {
      setError(errorText(t, e));
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !close.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('executions.reportsTab.closeTitle')}</DialogTitle>
          <DialogDescription>{t('executions.reportsTab.closeDescription')}</DialogDescription>
        </DialogHeader>
        <p className="text-sm whitespace-pre-line">{report.text}</p>
        <div className="grid gap-1.5">
          <Label htmlFor="close-report-comment">{t('executions.reportsTab.closeComment')}</Label>
          <Textarea
            id="close-report-comment"
            value={comment}
            maxLength={PROBLEM_REPORT_LIMITS.closeCommentMax}
            aria-invalid={Boolean(error)}
            onChange={(e) => {
              setError(null);
              setComment(e.target.value);
            }}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={close.isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void submit()} disabled={close.isPending}>
            {t('executions.reportsTab.closeSave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
