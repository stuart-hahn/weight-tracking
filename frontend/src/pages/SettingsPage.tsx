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
  const [exporting, setExporting] = useState(false);
  const [blockStart, setBlockStart] = useState('');
  const [savingBlock, setSavingBlock] = useState(false);

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

  return (
    <section className="app__card" aria-label="Settings">
      <h2 className="app__card-title">Settings</h2>
      <p className="progress-text progress-text--mb-lg">
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
          />
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
        <button type="submit" className="btn btn--primary form-submit-mt" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
      <div className="settings-section">
        <h3 className="app__card-title app__card-title--sub">
          Strength training block
        </h3>
        <p className="progress-text progress-text--mb-md progress-text--fine">
          Set the start date of your current mesocycle. Week index (for deload on week 6 and calibration cues) is computed as
          full weeks since this date. Leave empty to default to week 1 behavior.
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
        <button type="button" className="btn btn--secondary" disabled={savingBlock} onClick={() => void saveTrainingBlock()}>
          {savingBlock ? 'Saving…' : 'Save block start'}
        </button>
      </div>
      <div className="settings-section">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? 'Preparing…' : 'Download my data (export)'}
        </button>
        <p className="form-hint form-hint--tight">
          Export your profile, entries, workouts, programs, and optional metrics as JSON.
        </p>
      </div>
    </section>
  );
}
