import {
  addDays,
  FEATURES,
  localDateOf,
  PLAN_CATALOGUE,
  PLAN_PERIODS,
  PLANS,
  type FeatureKey,
  type PlanKey,
  type PlanPeriod,
  type SubscriptionSettings,
  subscriptionInputSchema,
} from '@edildy/contracts';
import { useTranslation } from 'react-i18next';
import { CheckboxList } from '@/components/checkbox-list';
import { Field } from '@/components/field';
import { NativeSelect } from '@/components/native-select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** The subscription form's state: numbers as typed, so an empty override means "the plan's limit". */
export interface SubscriptionDraft {
  plan: PlanKey;
  period: PlanPeriod;
  startsOn: string;
  endsOn: string;
  noEnd: boolean;
  branchLimit: string;
  extraFeatures: FeatureKey[];
  staffLimitOverride: string;
  workerLimitOverride: string;
}

export function newDraft(today = localDateOf(new Date(), 'Asia/Baku')): SubscriptionDraft {
  return { plan: 'basic', period: 'yearly', startsOn: today, endsOn: addDays(today, 365), noEnd: false, branchLimit: '1', extraFeatures: [], staffLimitOverride: '', workerLimitOverride: '' };
}

export function draftOf(s: SubscriptionSettings): SubscriptionDraft {
  return {
    plan: s.plan,
    period: s.period,
    startsOn: s.startsOn,
    endsOn: s.endsOn ?? addDays(s.startsOn, 365),
    noEnd: s.endsOn === null,
    branchLimit: String(s.branchLimit),
    extraFeatures: [...s.extraFeatures],
    staffLimitOverride: s.staffLimitOverride === null ? '' : String(s.staffLimitOverride),
    workerLimitOverride: s.workerLimitOverride === null ? '' : String(s.workerLimitOverride),
  };
}

const num = (v: string) => (v.trim() === '' ? null : Number(v));

/** The draft as the API input, or the first problem's field. Add-ons already in the new plan are dropped. */
export function parseDraft(d: SubscriptionDraft): { ok: true; value: SubscriptionSettings } | { ok: false; field: string } {
  const inPlan = new Set<FeatureKey>(PLAN_CATALOGUE[d.plan].features);
  const r = subscriptionInputSchema.safeParse({
    plan: d.plan,
    period: d.period,
    startsOn: d.startsOn,
    endsOn: d.noEnd ? null : d.endsOn,
    branchLimit: Number(d.branchLimit),
    extraFeatures: d.extraFeatures.filter((f) => !inPlan.has(f)),
    staffLimitOverride: num(d.staffLimitOverride),
    workerLimitOverride: num(d.workerLimitOverride),
  });
  return r.success ? { ok: true, value: r.data } : { ok: false, field: String(r.error.issues[0]?.path[0] ?? 'plan') };
}

/** Plan, period, dates, branches, add-ons and limit overrides; shared by "New organisation" and the subscription dialog. */
export function SubscriptionFields({ value, onChange, invalid }: { value: SubscriptionDraft; onChange: (next: SubscriptionDraft) => void; invalid?: string | null }) {
  const { t } = useTranslation();
  const set = <K extends keyof SubscriptionDraft>(k: K, v: SubscriptionDraft[K]) => onChange({ ...value, [k]: v });
  const def = PLAN_CATALOGUE[value.plan];
  // XL includes everything: nothing to add on.
  const addOns = FEATURES.filter((f) => !def.features.includes(f));
  const branches = Math.max(1, Number(value.branchLimit) || 1);
  const total = def.pricePerBranch + (branches - 1) * def.extraBranchPrice;
  const err = (field: string) => (invalid === field ? t('errors.validation.invalid') : null);
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="sub-plan" label={t('subscription.plan')} required>
          <NativeSelect id="sub-plan" value={value.plan} onChange={(e) => set('plan', e.target.value as PlanKey)}>
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {t(`subscription.plans.${p}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="sub-period" label={t('subscription.period')} required>
          <NativeSelect id="sub-period" value={value.period} onChange={(e) => set('period', e.target.value as PlanPeriod)}>
            {PLAN_PERIODS.map((p) => (
              <option key={p} value={p}>
                {t(`subscription.periods.${p}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="sub-starts" label={t('subscription.startsOn')} required error={err('startsOn')}>
          <Input id="sub-starts" type="date" value={value.startsOn} onChange={(e) => set('startsOn', e.target.value)} />
        </Field>
        <Field id="sub-ends" label={t('subscription.endsOn')} error={err('endsOn')}>
          <Input id="sub-ends" type="date" value={value.endsOn} disabled={value.noEnd} onChange={(e) => set('endsOn', e.target.value)} />
          <div className="flex items-center gap-2">
            <Checkbox id="sub-no-end" checked={value.noEnd} onCheckedChange={(c) => set('noEnd', c === true)} />
            <Label htmlFor="sub-no-end" className="font-normal">
              {t('platform.subscription.noEnd')}
            </Label>
          </div>
        </Field>
        <Field id="sub-branches" label={t('platform.subscription.branchLimit')} required error={err('branchLimit')} description={t('subscription.branchesHint')}>
          <Input id="sub-branches" type="number" min={1} value={value.branchLimit} onChange={(e) => set('branchLimit', e.target.value)} />
        </Field>
        <div />
        <Field
          id="sub-staff"
          label={t('platform.subscription.staffOverride')}
          error={err('staffLimitOverride')}
          description={t('platform.subscription.overrideHint', { limit: def.staffLimit ?? t('subscription.unlimited') })}
        >
          <Input id="sub-staff" type="number" min={1} value={value.staffLimitOverride} onChange={(e) => set('staffLimitOverride', e.target.value)} />
        </Field>
        <Field
          id="sub-workers"
          label={t('platform.subscription.workerOverride')}
          error={err('workerLimitOverride')}
          description={t('platform.subscription.overrideHint', { limit: def.workerLimit ?? t('subscription.unlimited') })}
        >
          <Input id="sub-workers" type="number" min={1} value={value.workerLimitOverride} onChange={(e) => set('workerLimitOverride', e.target.value)} />
        </Field>
      </div>
      {addOns.length > 0 && (
        <div className="grid gap-1.5">
          <CheckboxList
            label={t('platform.subscription.extraFeatures')}
            options={addOns.map((f) => ({ value: f, label: t(`subscription.features.${f}`) }))}
            value={value.extraFeatures.filter((f) => addOns.includes(f))}
            onChange={(next) => set('extraFeatures', next as FeatureKey[])}
          />
          <p className="text-muted-foreground text-xs">{t('platform.subscription.extraHint')}</p>
        </div>
      )}
      <p className="text-muted-foreground text-sm">{t('platform.subscription.price', { price: def.pricePerBranch, extra: def.extraBranchPrice, total })}</p>
    </div>
  );
}
