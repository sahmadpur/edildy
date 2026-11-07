import { MEDIA_KINDS, type MediaKind, PROBLEM_REPORT_LIMITS, PROBLEM_SEVERITIES, type ProblemSeverity, type ReportSite } from '@taskop/contracts';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormError } from '@/components/form-error';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { CaptureModal, pickFromGallery } from '@/features/execution/capture';
import { CaptureError } from '@/features/execution/media-capture';
import { Chip, Choice } from '@/features/execution/parts';
import { ScreenHeader } from '@/features/tasks/screen-header';
import { useSession } from '@/lib/session';
import { colors, font, spacing, type } from '@/lib/theme';
import { openSettings } from '@/notifications/native';
import { useOffline } from '@/offline/context';
import type { CapturedMedia } from '@/offline/execution-store';
import { useLiveQuery } from '@/offline/hooks';
import { acquireLocation, type Fix, LOCATION_TIMEOUT_MS, type LocationOutcome, type LocationPort, nativeLocation } from './location';

type LocationState = { status: 'searching' } | LocationOutcome;

/**
 * 2026-11-06 design §7.5: report a problem with a site, a severity, text, up to five photos or videos and the GPS position.
 * Works offline: the report is written to the phone and syncs when it can. Location is lenient: after 15 s without a fix
 * the worker may send without one (asked once).
 */
export function NewReportScreen({ location = nativeLocation }: { location?: LocationPort }) {
  const { t } = useTranslation();
  const services = useOffline();
  const session = useSession();
  const reporterName = session.status === 'authenticated' ? session.me.user.fullName : '';
  const sites = useLiveQuery((s) => s.reports.sites(), []);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [severity, setSeverity] = useState<ProblemSeverity>('normal');
  const [text, setText] = useState('');
  const [media, setMedia] = useState<CapturedMedia[]>([]);
  const [camera, setCamera] = useState<MediaKind | null>(null);
  const [loc, setLoc] = useState<LocationState>({ status: 'searching' });
  const [waited, setWaited] = useState(false);
  const [fields, setFields] = useState<{ text?: string; site?: string }>({});
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const sent = useRef(false);
  const mediaRef = useRef(media);
  mediaRef.current = media;

  // The first site is preselected; one site needs no choice at all.
  useEffect(() => {
    if (siteId === null && sites && sites.length > 0) setSiteId(sites[0]!.id);
  }, [sites, siteId]);

  const search = () => {
    setLoc({ status: 'searching' });
    void acquireLocation(location).then((outcome) => setLoc(outcome));
  };
  useEffect(() => {
    search();
    const timer = setTimeout(() => setWaited(true), LOCATION_TIMEOUT_MS);
    return () => clearTimeout(timer);
    // Once, on mount; `location` is the port the screen was given.
  }, []);

  const removeFile = (uri: string) => {
    try {
      services.files.remove(uri);
    } catch {
      // Already gone.
    }
  };
  // Media captured for a report never sent are deleted when the screen closes.
  useEffect(
    () => () => {
      if (!sent.current) mediaRef.current.forEach((m) => removeFile(m.localUri));
    },
    [services],
  );

  const full = media.length >= PROBLEM_REPORT_LIMITS.maxMedia;
  const addFromGallery = async (kind: MediaKind) => {
    try {
      const picked = await pickFromGallery(kind);
      if (picked) setMedia((xs) => [...xs, picked]);
    } catch (e) {
      Alert.alert(e instanceof CaptureError ? t(`mobile.evidence.${e.problem}`) : t('mobile.evidence.failed'));
    }
  };
  const remove = (m: CapturedMedia) => {
    setMedia((xs) => xs.filter((x) => x !== m));
    removeFile(m.localUri);
  };

  const send = async (fix: Fix | null) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const site = (sites ?? []).find((s) => s.id === siteId)!;
      await services.reports.create({ siteId: site.id, siteName: site.name, severity, text: text.trim(), location: fix, reporterName }, media);
      sent.current = true;
      Alert.alert(t('mobile.problems.new.sent'));
      router.back();
    } catch (e) {
      inFlight.current = false;
      Alert.alert(e instanceof Error ? e.message : t('errors.INTERNAL', { requestId: '—' }));
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    const invalid: { text?: string; site?: string } = {};
    if (!text.trim()) invalid.text = t('mobile.problems.new.textRequired');
    if (!siteId || !(sites ?? []).some((s) => s.id === siteId)) invalid.site = t('mobile.problems.new.siteRequired');
    setFields(invalid);
    if (Object.keys(invalid).length > 0) return;
    if (loc.status === 'found') return void send(loc.fix);
    // Lenient (owner's decision): once, before sending without a location.
    Alert.alert(t('mobile.problems.location.sendWithout'), undefined, [
      { text: t('mobile.problems.location.wait'), style: 'cancel' },
      { text: t('mobile.problems.location.sendAnyway'), onPress: () => void send(null) },
    ]);
  };

  const searching = loc.status === 'searching' && !waited;
  return (
    <Screen>
      <ScreenHeader title={t('mobile.problems.new.title')} />
      <Text style={styles.label}>{t('mobile.problems.new.site')}</Text>
      {sites === undefined ? (
        <ActivityIndicator color={colors.primary} />
      ) : sites.length === 0 ? (
        <Text style={styles.muted}>{t('mobile.problems.noSites')}</Text>
      ) : sites.length === 1 ? (
        <Text style={styles.text}>{sites[0]!.name}</Text>
      ) : (
        <View style={styles.row}>
          {sites.map((s: ReportSite) => (
            <Choice key={s.id} role="radio" label={s.name} selected={siteId === s.id} onPress={() => setSiteId(s.id)} />
          ))}
        </View>
      )}
      <FormError message={fields.site ?? null} />
      <Text style={styles.label}>{t('mobile.problems.new.severity')}</Text>
      <View style={styles.row}>
        {PROBLEM_SEVERITIES.map((s) => (
          <Choice key={s} role="radio" label={t(`executions.severities.${s}`)} selected={severity === s} onPress={() => setSeverity(s)} />
        ))}
      </View>
      <Text style={styles.label}>{t('mobile.problems.new.text')}</Text>
      <TextInput
        accessibilityLabel={t('mobile.problems.new.text')}
        placeholder={t('mobile.problems.new.textPlaceholder')}
        value={text}
        onChangeText={(v) => {
          setFields(({ text: _cleared, ...rest }) => rest);
          setText(v);
        }}
        multiline
        maxLength={PROBLEM_REPORT_LIMITS.textMax}
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <FormError message={fields.text ?? null} />
      <Text style={styles.label}>{t('mobile.problems.new.media')}</Text>
      <View style={styles.row}>
        {media.map((m, n) => (
          <Pressable key={m.localUri} testID={`report-media-${n}`} accessibilityRole="button" accessibilityLabel={`${t(`executions.mediaKinds.${m.kind}`)} ${n + 1}`} onLongPress={() => remove(m)} style={styles.thumb}>
            {m.kind === 'photo' ? <Image source={{ uri: m.localUri }} style={styles.thumb} /> : <Text style={styles.play}>▶</Text>}
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        {MEDIA_KINDS.map((kind) => (
          <View key={kind} style={styles.row}>
            <Chip label={`${t(`executions.mediaKinds.${kind}`)}: ${t('mobile.evidence.camera')}`} disabled={full} onPress={() => setCamera(kind)} />
            <Chip label={`${t(`executions.mediaKinds.${kind}`)}: ${t('mobile.evidence.gallery')}`} disabled={full} onPress={() => void addFromGallery(kind)} />
          </View>
        ))}
      </View>
      <View style={styles.location}>
        {loc.status === 'searching' ? (
          <View style={styles.row}>
            <ActivityIndicator color={colors.primary} />
            <Text testID="location-status" style={styles.muted}>
              {t('mobile.problems.location.searching')}
            </Text>
          </View>
        ) : loc.status === 'found' ? (
          <Text style={styles.text}>{t('mobile.problems.location.found', { m: Math.round(loc.fix.accuracyM ?? 0) })}</Text>
        ) : loc.status === 'denied' ? (
          <View style={styles.row}>
            <Text style={styles.warning}>{t('mobile.problems.location.denied')}</Text>
            <Chip label={t('mobile.problems.location.openSettings')} onPress={() => void openSettings()} />
          </View>
        ) : (
          <View style={styles.row}>
            <Text style={styles.warning}>{t('mobile.problems.location.notFound')}</Text>
            <Chip label={t('mobile.problems.location.retry')} onPress={search} />
          </View>
        )}
      </View>
      <PrimaryButton title={searching ? t('mobile.problems.location.searching') : t('mobile.problems.new.send')} onPress={submit} disabled={busy || searching} />
      {camera ? (
        <CaptureModal
          kind={camera}
          onClose={() => setCamera(null)}
          onCaptured={(m) => {
            setCamera(null);
            setMedia((xs) => [...xs, m]);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: font, fontWeight: '600', color: colors.text, marginTop: spacing.sm },
  text: { fontFamily: font, fontSize: type.base, color: colors.text },
  muted: { fontFamily: font, fontSize: type.base, color: colors.muted },
  warning: { fontFamily: font, fontSize: type.base, color: colors.dangerText },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  location: { minHeight: 44, justifyContent: 'center' },
  input: { minHeight: 96, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: spacing.md, fontSize: 16, backgroundColor: colors.surface, color: colors.text, textAlignVertical: 'top' },
  thumb: { width: 64, height: 64, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  play: { fontSize: 24, color: colors.text },
});
