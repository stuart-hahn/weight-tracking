import { useState, useEffect, useCallback, FormEvent, useMemo, useId } from 'react';
import { getUser, updateUser, exportUserData } from '../api/client';
import type { UserProfile, UpdateUserRequest, ActivityLevel, UnitsPreference } from '../types/api';
import { cmToIn, inToCm, kgToLb, lbToKg } from '../utils/units';
import { getDeviceTimeZone, listSelectableTimeZones } from '../utils/calendarDate';
import { useTimeZone } from '../context/TimeZonePreference';
import PageLoading from '../components/PageLoading';
import InlineFieldError from '../components/ui/InlineFieldError';
import Page from '../components/layout/Page';
import PageHeader from '../components/layout/PageHeader';

interface SettingsPageProps {
  userId: string;
  onError: (msg: string | null) => void;
  onSuccess: (msg: string | null) => void;
}

export default function SettingsPage({ userId, onError, onSuccess }: SettingsPageProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [heightCm, setHeightCm] = useState('');
  const [currentWeightKg, setCurrentWeightKg] = useState('');
  const [targetBodyFatPercent, setTargetBodyFatPercent] = useState('');
  const [activityLevel, setActivityLevel] = useState<string>('');
  const [leanMassKg, setLeanMassKg] = useState('');
  const [units, setUnits] = useState<UnitsPreference>('metric');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  const [blockStart, setBlockStart] = useState('');
  const [savingBlock, setSavingBlock] = useState(false);
  const [savingTz, setSavingTz] = useState(false);
  const { preference, effectiveTimeZone, setPreference } = useTimeZone();
  const selectableZones = useMemo(() => listSelectableTimeZones(), []);
  const zonesForSelect = useMemo(() => {
    if (preference === 'auto') return selectableZones;
    if (selectableZones.includes(preference)) return selectableZones;
    return [preference, ...selectableZones];
  }, [selectableZones, preference]);

  const tzSearchId = useId();
  const tzListId = useId();
  const [tzFilter, setTzFilter] = useState('');
  const filteredZones = useMemo(() => {
    const q = tzFilter.trim().toLowerCase();
    if (!q) return zonesForSelect;
    return zonesForSelect.filter((z) => z.toLowerCase().includes(q));
  }, [zonesForSelect, tzFilter]);

  useEffect(() => {
    let cancelled = false;
    getUser(userId)
      .then((p) => {
        if (!cancelled) {
          setProfile(p);
          setAge(String(p.age));
          setSex(p.sex);
          setHeightCm(String(p.height_cm));
          setCurrentWeightKg(String(p.current_weight_kg));
          setTargetBodyFatPercent(String(p.target_body_fat_percent));
          setActivityLevel(p.activity_level ?? '');
          setLeanMassKg(p.lean_mass_kg != null ? String(p.lean_mass_kg) : '');
          setUnits(p.units ?? 'metric');
          setBlockStart(p.training_block_started_at ? p.training_block_started_at.slice(0, 10) : '');
        }
      })
      .catch(() => {
        if (!cancelled) onError('Failed to load profile');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, onError]);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!profile) return;
      onError(null);
      onSuccess(null);
      setFieldErrors({});

      const errors: Record<string, string> = {};
      const body: UpdateUserRequest = {};
      const ageNum = Number(age);
      if (age.trim() !== '') {
        if (Number.isNaN(ageNum) || ageNum < 10 || ageNum > 120) errors.age = 'Enter an age between 10 and 120.';
        else if (ageNum !== profile.age) body.age = ageNum;
      }

      if (sex !== profile.sex) body.sex = sex;
      const heightNum = Number(heightCm);
      if (heightCm.trim() !== '') {
        if (Number.isNaN(heightNum) || heightNum <= 0 || heightNum > 300) errors.height = 'Enter a valid height.';
        else if (heightNum !== profile.height_cm) body.height_cm = heightNum;
      }
      const weightNum = Number(currentWeightKg);
      if (currentWeightKg.trim() !== '') {
        if (Number.isNaN(weightNum) || weightNum <= 0 || weightNum > 500) errors.currentWeight = 'Enter a valid weight.';
        else if (weightNum !== profile.current_weight_kg) body.current_weight_kg = weightNum;
      }
      const targetNum = Number(targetBodyFatPercent);
      if (targetBodyFatPercent.trim() !== '') {
        if (Number.isNaN(targetNum) || targetNum <= 0 || targetNum >= 100) errors.targetBodyFat = 'Enter a body fat target between 1 and 99.';
        else if (targetNum !== profile.target_body_fat_percent) body.target_body_fat_percent = targetNum;
      }
      if (['sedentary', 'light', 'moderate', 'very_active'].includes(activityLevel)) {
        const next = activityLevel as ActivityLevel;
        if (next !== profile.activity_level) body.activity_level = next;
      } else {
        if (profile.activity_level != null) body.activity_level = null;
      }
      const leanNum = leanMassKg.trim() === '' ? null : Number(leanMassKg);
      if (leanNum === null) {
        if (profile.lean_mass_kg != null) body.lean_mass_kg = null;
      } else if (Number.isNaN(leanNum) || leanNum <= 0 || leanNum > 500) {
        errors.leanMass = 'Enter a valid lean mass or leave blank.';
      } else if (leanNum !== profile.lean_mass_kg) {
        body.lean_mass_kg = leanNum;
      }

      if (units !== (profile.units ?? 'metric')) body.units = units;

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        onError('Fix the highlighted fields.');
        return;
      }
      if (Object.keys(body).length === 0) {
        onSuccess('No changes to save.');
        return;
      }
      setSaving(true);
      try {
        const updated = await updateUser(userId, body);
        setProfile(updated);
        onSuccess('Profile updated.');
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to update profile');
      } finally {
        setSaving(false);
      }
    },
    [profile, userId, age, sex, heightCm, currentWeightKg, targetBodyFatPercent, activityLevel, leanMassKg, units, onError, onSuccess]
  );

  const saveTrainingBlock = useCallback(async () => {
    onError(null);
    onSuccess(null);
    setSavingBlock(true);
    try {
      const updated = await updateUser(userId, {
        training_block_started_at: blockStart.trim() === '' ? null : blockStart.trim(),
      });
      setProfile(updated);
      onSuccess('Training block start saved.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingBlock(false);
    }
  }, [userId, blockStart, onError, onSuccess]);

  const saveTimeZoneToAccount = useCallback(async () => {
    onError(null);
    onSuccess(null);
    setSavingTz(true);
    try {
      const body: UpdateUserRequest =
        preference === 'auto' ? { timezone: null } : { timezone: preference };
      const updated = await updateUser(userId, body);
      setProfile(updated);
      onSuccess('Time zone saved to your account.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save time zone');
    } finally {
      setSavingTz(false);
    }
  }, [userId, preference, onError, onSuccess]);

  const handleExport = useCallback(async () => {
    onError(null);
    setExporting(true);
    try {
      await exportUserData(userId);
      onSuccess('Data downloaded.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [userId, onError, onSuccess]);

  if (loading) {
    return <PageLoading title="Settings" />;
  }

  if (!profile) return null;

  const timeZoneSynced =
    preference === 'auto'
      ? profile.timezone == null
      : profile.timezone === preference;

  return (
    <Page>
      <PageHeader
        title="Settings"
        description={
          <>
            Update your profile, units, and training block start. Your email is <strong>{profile.email}</strong>.
          </>
        }
      />

      <section className="app__card" aria-label="Profile">
        <h2 className="app__card-title">Profile</h2>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="settings-units">Units</label>
            <select
              id="settings-units"
              className="form-input"
              value={units}
              onChange={(e) => setUnits(e.target.value as UnitsPreference)}
            >
              <option value="metric">Metric (kg, cm)</option>
              <option value="imperial">Imperial (lb, in)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="settings-age">Age</label>
            <input
              id="settings-age"
              type="number"
              className="form-input"
              min={10}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              aria-invalid={fieldErrors.age ? true : undefined}
              aria-describedby={fieldErrors.age ? 'settings-age-error' : undefined}
            />
            <InlineFieldError id="settings-age-error" message={fieldErrors.age} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="settings-sex">Sex</label>
            <select
              id="settings-sex"
              className="form-input"
              value={sex}
              onChange={(e) => setSex(e.target.value as 'male' | 'female')}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="settings-height">
              Height ({units === 'imperial' ? 'in' : 'cm'})
            </label>
            <input
              id="settings-height"
              type="number"
              className="form-input"
              min={units === 'imperial' ? 20 : 1}
              max={units === 'imperial' ? 120 : 300}
              step={units === 'imperial' ? 1 : 0.1}
              value={units === 'imperial'
                ? (() => { const n = Number(heightCm); return Number.isNaN(n) ? '' : Math.round(cmToIn(n) * 10) / 10; })()
                : heightCm}
              onChange={(e) => {
                const v = e.target.value;
                if (units === 'imperial') {
                  const n = Number(v);
                  setHeightCm(Number.isNaN(n) ? '' : String(inToCm(n)));
                } else {
                  setHeightCm(v);
                }
              }}
              aria-invalid={fieldErrors.height ? true : undefined}
              aria-describedby={fieldErrors.height ? 'settings-height-error' : undefined}
            />
            <InlineFieldError id="settings-height-error" message={fieldErrors.height} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="settings-weight">
              Current weight ({units === 'imperial' ? 'lb' : 'kg'})
            </label>
            <input
              id="settings-weight"
              type="number"
              className="form-input"
              min={units === 'imperial' ? 44 : 1}
              max={units === 'imperial' ? 1100 : 500}
              step={units === 'imperial' ? 1 : 0.1}
              value={units === 'imperial'
                ? (() => { const n = Number(currentWeightKg); return Number.isNaN(n) ? '' : Math.round(kgToLb(n)); })()
                : currentWeightKg}
              onChange={(e) => {
                const v = e.target.value;
                if (units === 'imperial') {
                  const n = Number(v);
                  setCurrentWeightKg(Number.isNaN(n) ? '' : String(lbToKg(n)));
                } else {
                  setCurrentWeightKg(v);
                }
              }}
              aria-invalid={fieldErrors.currentWeight ? true : undefined}
              aria-describedby={fieldErrors.currentWeight ? 'settings-weight-error' : undefined}
            />
            <InlineFieldError id="settings-weight-error" message={fieldErrors.currentWeight} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="settings-target-bf">Target body fat (%)</label>
            <input
              id="settings-target-bf"
              type="number"
              className="form-input"
              min={1}
              max={99}
              step={0.5}
              value={targetBodyFatPercent}
              onChange={(e) => setTargetBodyFatPercent(e.target.value)}
              aria-invalid={fieldErrors.targetBodyFat ? true : undefined}
              aria-describedby={fieldErrors.targetBodyFat ? 'settings-target-bf-error' : undefined}
            />
            <InlineFieldError id="settings-target-bf-error" message={fieldErrors.targetBodyFat} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="settings-activity">Activity level</label>
            <select
              id="settings-activity"
              className="form-input"
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value)}
            >
              <option value="">—</option>
              <option value="sedentary">Sedentary</option>
              <option value="light">Light</option>
              <option value="moderate">Moderate</option>
              <option value="very_active">Very active</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="settings-lean">
              Lean mass ({units === 'imperial' ? 'lb' : 'kg'}, optional)
            </label>
            <input
              id="settings-lean"
              type="number"
              className="form-input"
              min={1}
              max={500}
              step={0.1}
              placeholder="Leave blank to estimate"
              value={
                units === 'imperial'
                  ? (() => {
                      const n = Number(leanMassKg);
                      return Number.isNaN(n) ? '' : Math.round(kgToLb(n));
                    })()
                  : leanMassKg
              }
              onChange={(e) => {
                const v = e.target.value;
                if (units === 'imperial') {
                  const n = Number(v);
                  setLeanMassKg(Number.isNaN(n) ? '' : String(lbToKg(n)));
                } else {
                  setLeanMassKg(v);
                }
              }}
              aria-invalid={fieldErrors.leanMass ? true : undefined}
              aria-describedby={fieldErrors.leanMass ? 'settings-lean-error' : undefined}
            />
            <InlineFieldError id="settings-lean-error" message={fieldErrors.leanMass} />
          </div>
          <button type="submit" className="btn btn--primary btn--block form-submit-mt" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </section>

      <section className="app__card settings-section" aria-label="Time zone">
        <h2 className="app__card-title">Time zone</h2>
        <p className="progress-text progress-text--mb-md progress-text--fine">
          Log date, “today” reminders, and the date picker max use your effective zone:{' '}
          <strong>{effectiveTimeZone}</strong>
          {preference === 'auto' ? ' (from this device)' : ' (fixed choice)'}.
        </p>
        <fieldset className="form-group fieldset--plain">
          <legend className="form-label">Calendar day source</legend>
          <label className="settings-radio-line">
            <input
              type="radio"
              name="tz-mode"
              checked={preference === 'auto'}
              onChange={() => setPreference('auto')}
            />
            <span>Use device time zone ({getDeviceTimeZone()})</span>
          </label>
          <label className="settings-radio-line">
            <input
              type="radio"
              name="tz-mode"
              checked={preference !== 'auto'}
              onChange={() => setPreference(getDeviceTimeZone())}
            />
            <span>Choose IANA time zone</span>
          </label>
        </fieldset>
        {preference !== 'auto' && (
          <div className="form-group">
            <label className="form-label" htmlFor={tzSearchId}>
              Search time zones
            </label>
            <input
              id={tzSearchId}
              type="search"
              className="form-input"
              value={tzFilter}
              onChange={(e) => setTzFilter(e.target.value)}
              placeholder="e.g. Tokyo, New_York"
              autoComplete="off"
              aria-controls={tzListId}
            />
            <div className="form-hint form-hint--tight">Type to filter, then tap a zone. Current: {preference}</div>
            <div
              id={tzListId}
              className="settings-tz-list"
              role="listbox"
              aria-label="Matching IANA time zones"
            >
              {filteredZones.length === 0 ? (
                <p className="progress-text settings-tz-list__empty">No matches. Try a shorter search.</p>
              ) : (
                <ul className="settings-tz-list__ul">
                  {filteredZones.map((z) => (
                    <li key={z}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={preference === z}
                        className={`settings-tz-list__btn${preference === z ? ' settings-tz-list__btn--active' : ''}`}
                        onClick={() => setPreference(z)}
                      >
                        {z}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        <button
          type="button"
          className="btn btn--secondary btn--block"
          disabled={savingTz || timeZoneSynced}
          onClick={() => void saveTimeZoneToAccount()}
        >
          {savingTz ? 'Saving…' : 'Save time zone to account'}
        </button>
        <p className="form-hint form-hint--tight">
          The choice above applies on this device right away. Use the button to sync it across devices (or clear the override).
        </p>
      </section>

      <section className="app__card settings-section" aria-label="Strength training block">
        <h2 className="app__card-title">Strength training block</h2>
        <p className="progress-text progress-text--mb-md progress-text--fine">
          Set the start date of your current mesocycle. Week index (for deload on week 6 and calibration cues) is computed as full weeks since this date.
          Leave empty to default to week 1 behavior.
        </p>
        <div className="form-group">
          <label className="form-label" htmlFor="settings-block-start">
            Block started (date)
          </label>
          <input
            id="settings-block-start"
            type="date"
            className="form-input"
            value={blockStart}
            onChange={(e) => setBlockStart(e.target.value)}
          />
        </div>
        <button type="button" className="btn btn--secondary btn--block" disabled={savingBlock} onClick={() => void saveTrainingBlock()}>
          {savingBlock ? 'Saving…' : 'Save block start'}
        </button>
      </section>

      <section className="app__card settings-section" aria-label="Export data">
        <h2 className="app__card-title">Export</h2>
        <button
          type="button"
          className="btn btn--secondary btn--block"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? 'Preparing…' : 'Download my data (export)'}
        </button>
        <p className="form-hint form-hint--tight">
          Export your profile, entries, workouts, programs, and optional metrics as JSON.
        </p>
      </section>
    </Page>
  );
}
