import { useState, useEffect, useCallback, FormEvent } from 'react';
import { getUser, updateUser, exportUserData } from '../api/client';
import type { UserProfile, UpdateUserRequest, ActivityLevel, UnitsPreference } from '../types/api';
import { cmToIn, inToCm, kgToLb, lbToKg } from '../utils/units';
import PageLoading from '../components/PageLoading';

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
  const [timezone, setTimezone] = useState('');
  const [exporting, setExporting] = useState(false);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

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
          setTimezone(p.timezone ?? '');
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
      setLocalError(null);
      setLocalSuccess(null);
      const body: UpdateUserRequest = {};
      const ageNum = Number(age);
      if (!Number.isNaN(ageNum) && ageNum >= 10 && ageNum <= 120) body.age = ageNum;
      body.sex = sex;
      const heightNum = Number(heightCm);
      if (!Number.isNaN(heightNum) && heightNum > 0 && heightNum <= 300) body.height_cm = heightNum;
      const weightNum = Number(currentWeightKg);
      if (!Number.isNaN(weightNum) && weightNum > 0 && weightNum <= 500) body.current_weight_kg = weightNum;
      const targetNum = Number(targetBodyFatPercent);
      if (!Number.isNaN(targetNum) && targetNum > 0 && targetNum < 100) body.target_body_fat_percent = targetNum;
      if (['sedentary', 'light', 'moderate', 'very_active'].includes(activityLevel)) {
        body.activity_level = activityLevel as ActivityLevel;
      } else {
        body.activity_level = null;
      }
      const leanNum = leanMassKg.trim() === '' ? null : Number(leanMassKg);
      if (leanNum !== null && !Number.isNaN(leanNum) && leanNum > 0 && leanNum <= 500) {
        body.lean_mass_kg = leanNum;
      } else {
        body.lean_mass_kg = null;
      }
      body.units = units;
      body.timezone = timezone === '' ? null : timezone;
      if (Object.keys(body).length === 0) {
        setLocalSuccess("You haven't changed anything yet.");
        return;
      }
      setSaving(true);
      try {
        const updated = await updateUser(userId, body);
        setProfile(updated);
        setLocalSuccess('Your profile is updated.');
        onSuccess(null);
        window.setTimeout(() => setLocalSuccess(null), 3000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update profile';
        setLocalError(msg);
        onError(null);
      } finally {
        setSaving(false);
      }
    },
    [profile, userId, age, sex, heightCm, currentWeightKg, targetBodyFatPercent, activityLevel, leanMassKg, units, timezone, onError, onSuccess]
  );

  const handleExport = useCallback(async () => {
    onError(null);
    setLocalError(null);
    setLocalSuccess(null);
    setExporting(true);
    try {
      await exportUserData(userId);
      setLocalSuccess('Your data is downloaded.');
      onSuccess(null);
      window.setTimeout(() => setLocalSuccess(null), 3000);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Export failed');
      onError(null);
    } finally {
      setExporting(false);
    }
  }, [userId, onError, onSuccess]);

  if (loading) {
    return <PageLoading title="Settings" />;
  }

  if (!profile) return null;

  return (
    <section className="app__card" aria-label="Settings">
      <h2 className="app__card-title">Settings</h2>
      {localError && (
        <div className="app__error" role="alert" style={{ marginBottom: '1rem' }}>
          {localError}
        </div>
      )}
      {localSuccess && (
        <div className="app__success" role="status" style={{ marginBottom: '1rem' }}>
          {localSuccess}
        </div>
      )}
      <p className="progress-text" style={{ marginBottom: '1rem' }}>
        {profile.email}
      </p>
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
          <label className="form-label" htmlFor="settings-timezone">Timezone</label>
          <select
            id="settings-timezone"
            className="form-input"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            <option value="">Use browser default</option>
            <option value="America/New_York">Eastern Time (America/New_York)</option>
            <option value="America/Chicago">Central Time (America/Chicago)</option>
            <option value="America/Denver">Mountain Time (America/Denver)</option>
            <option value="America/Los_Angeles">Pacific Time (America/Los_Angeles)</option>
            <option value="America/Toronto">Toronto (America/Toronto)</option>
            <option value="America/Vancouver">Vancouver (America/Vancouver)</option>
            <option value="Europe/London">London (Europe/London)</option>
            <option value="Europe/Paris">Paris (Europe/Paris)</option>
            <option value="Europe/Berlin">Berlin (Europe/Berlin)</option>
            <option value="Australia/Sydney">Sydney (Australia/Sydney)</option>
            <option value="Asia/Tokyo">Tokyo (Asia/Tokyo)</option>
            <option value="Asia/Kolkata">India (Asia/Kolkata)</option>
            <option value="UTC">UTC</option>
            {timezone && ![
              '', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
              'America/Toronto', 'America/Vancouver', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
              'Australia/Sydney', 'Asia/Tokyo', 'Asia/Kolkata', 'UTC',
            ].includes(timezone) && (
              <option value={timezone}>{timezone}</option>
            )}
          </select>
          <p className="form-hint" style={{ marginTop: '0.25rem' }}>
            Used for &quot;today&quot; when logging weight so dates match your local day. We use this so &quot;today&quot; and your summaries match your location.
          </p>
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
          />
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
        {units === 'metric' ? (
          <div className="form-group">
            <label className="form-label" htmlFor="settings-height-cm">Height (cm)</label>
            <input
              id="settings-height-cm"
              type="number"
              className="form-input"
              min={1}
              max={300}
              step={0.1}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="settings-height-ft">Height (feet)</label>
              <input
                id="settings-height-ft"
                type="number"
                className="form-input"
                min={2}
                max={8}
                step={1}
                value={heightCm === '' ? '' : Math.floor(cmToIn(Number(heightCm)) / 12)}
                onChange={(e) => {
                  const ft = Number(e.target.value);
                  const inch = heightCm === '' ? 0 : Math.round(cmToIn(Number(heightCm)) % 12);
                  setHeightCm(Number.isNaN(ft) ? '' : String(inToCm(ft * 12 + inch)));
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="settings-height-in">Height (inches)</label>
              <input
                id="settings-height-in"
                type="number"
                className="form-input"
                min={0}
                max={11}
                step={1}
                value={heightCm === '' ? '' : Math.round(cmToIn(Number(heightCm)) % 12)}
                onChange={(e) => {
                  const inch = Number(e.target.value);
                  const ft = heightCm === '' ? 0 : Math.floor(cmToIn(Number(heightCm)) / 12);
                  if (Number.isNaN(inch) || inch < 0 || inch > 11) return;
                  setHeightCm(String(inToCm(ft * 12 + inch)));
                }}
              />
            </div>
          </>
        )}
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
            step={0.1}
            value={units === 'imperial'
              ? (() => {
                  const n = Number(currentWeightKg);
                  if (Number.isNaN(n)) return '';
                  const lb = Math.round(kgToLb(n) * 10) / 10;
                  return lb % 1 === 0 ? String(lb) : lb.toFixed(1);
                })()
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
          />
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
          />
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
          <label className="form-label" htmlFor="settings-lean">Lean mass (kg, optional)</label>
          <input
            id="settings-lean"
            type="number"
            className="form-input"
            min={1}
            max={500}
            step={0.1}
            placeholder="Leave blank to estimate"
            value={leanMassKg}
            onChange={(e) => setLeanMassKg(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn--primary" style={{ marginTop: '1rem' }} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
      <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? 'Preparing…' : 'Download my data (export)'}
        </button>
        <p className="form-hint" style={{ marginTop: '0.5rem' }}>
          Download your profile, weigh-ins, and optional metrics as a JSON file.
        </p>
      </div>
    </section>
  );
}
