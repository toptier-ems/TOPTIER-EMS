import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { POSITION_LABELS, EMPLOYEE_BADGE_LABELS } from '../types/database';
import type { EmployeeBadge } from '../types/database';
import type { Accomplishment, Profile, Skill, Interest } from '../types/database';
import { EMPLOYMENT_TYPES, MONTHS } from '../types/database';
import ProfilePDF from '../components/ProfilePDF';
import { Plus, Trash2, X, Info, Award } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => currentYear - i);

const POINTS_PER_LEVEL = 100;
function getFeedLevel(points: number): { level: number; progress: number; pointsToNext: number } {
  const pts = Math.max(0, Math.floor(points ?? 0));
  const level = Math.min(100, 1 + Math.floor(pts / POINTS_PER_LEVEL));
  const pointsInLevel = pts - (level - 1) * POINTS_PER_LEVEL;
  const progress = level >= 100 ? 1 : pointsInLevel / POINTS_PER_LEVEL;
  const pointsToNext = level >= 100 ? 0 : POINTS_PER_LEVEL - pointsInLevel;
  return { level, progress, pointsToNext };
}

export default function ProfilePage() {
  const { userId: paramUserId } = useParams<{ userId: string }>();
  const { user, profile } = useAuth();
  const [viewProfile, setViewProfile] = useState<Profile | null | undefined>(undefined);
  const [viewAccomplishments, setViewAccomplishments] = useState<Accomplishment[]>([]);
  const [viewSkills, setViewSkills] = useState<Skill[]>([]);
  const [viewInterests, setViewInterests] = useState<Interest[]>([]);
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
  const [certByAccId, setCertByAccId] = useState<Record<string, string>>({});
  const [viewCertByAccId, setViewCertByAccId] = useState<Record<string, string>>({});
  const [skills, setSkills] = useState<Skill[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddExperience, setShowAddExperience] = useState(false);
  const [form, setForm] = useState({
    title: '',
    company: '',
    employment_type: '',
    description: '',
    is_current_role: true,
    start_month: '',
    start_year: '',
    end_month: '',
    end_year: '',
    location: '',
  });

  const isOwnProfile = !paramUserId || paramUserId === user?.id;

  useEffect(() => {
    if (paramUserId && paramUserId !== user?.id) {
      (async () => {
        const [profRes, accRes, skillRes, intRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', paramUserId).single(),
          supabase.from('accomplishments').select('*').eq('user_id', paramUserId).order('start_date', { ascending: false, nullsFirst: false }).order('achieved_at', { ascending: false }),
          supabase.from('skills').select('*').eq('user_id', paramUserId),
          supabase.from('interests').select('*').eq('user_id', paramUserId),
        ]);
        const accList = (accRes.data as Accomplishment[]) ?? [];
        setViewProfile(profRes.data as Profile | null);
        setViewAccomplishments(accList);
        setViewSkills((skillRes.data as Skill[]) ?? []);
        setViewInterests((intRes.data as Interest[]) ?? []);
        const pdAccIds = accList.filter((a) => a.source_type === 'pd').map((a) => a.id);
        if (pdAccIds.length) {
          const { data: certs } = await supabase.from('pd_certificates').select('id, accomplishment_id').in('accomplishment_id', pdAccIds);
          const map: Record<string, string> = {};
          (certs ?? []).forEach((c: { id: string; accomplishment_id: string }) => { map[c.accomplishment_id] = c.id; });
          setViewCertByAccId(map);
        } else setViewCertByAccId({});
      })();
      return;
    }
    setViewProfile(undefined);
    setViewAccomplishments([]);
    setViewSkills([]);
    setViewInterests([]);
    setViewCertByAccId({});
  }, [paramUserId, user?.id]);

  useEffect(() => {
    if (!user?.id || !isOwnProfile) return;
    (async () => {
      const [accRes, skillRes, intRes] = await Promise.all([
        supabase.from('accomplishments').select('*').eq('user_id', user.id).order('start_date', { ascending: false, nullsFirst: false }).order('achieved_at', { ascending: false }),
        supabase.from('skills').select('*').eq('user_id', user.id),
        supabase.from('interests').select('*').eq('user_id', user.id),
      ]);
      const accList = (accRes.data as Accomplishment[]) ?? [];
      setAccomplishments(accList);
      setSkills((skillRes.data as Skill[]) ?? []);
      setInterests((intRes.data as Interest[]) ?? []);
      const pdAccIds = accList.filter((a) => a.source_type === 'pd').map((a) => a.id);
      if (pdAccIds.length) {
        const { data: certs } = await supabase.from('pd_certificates').select('id, accomplishment_id').in('accomplishment_id', pdAccIds);
        const map: Record<string, string> = {};
        (certs ?? []).forEach((c: { id: string; accomplishment_id: string }) => { map[c.accomplishment_id] = c.id; });
        setCertByAccId(map);
      } else setCertByAccId({});
    })();
    setLoading(false);
  }, [user?.id, isOwnProfile]);

  const addSkill = async () => {
    if (!user?.id || !newSkill.trim()) return;
    await supabase.from('skills').insert({ user_id: user.id, name: newSkill.trim() });
    const { data } = await supabase.from('skills').select('*').eq('user_id', user.id);
    setSkills((data as Skill[]) ?? []);
    setNewSkill('');
  };

  const deleteSkill = async (id: string) => {
    await supabase.from('skills').delete().eq('id', id);
    setSkills((prev) => prev.filter((s) => s.id !== id));
  };

  const addInterest = async () => {
    if (!user?.id || !newInterest.trim()) return;
    await supabase.from('interests').insert({ user_id: user.id, name: newInterest.trim() });
    const { data } = await supabase.from('interests').select('*').eq('user_id', user.id);
    setInterests((data as Interest[]) ?? []);
    setNewInterest('');
  };

  const deleteInterest = async (id: string) => {
    await supabase.from('interests').delete().eq('id', id);
    setInterests((prev) => prev.filter((i) => i.id !== id));
  };

  const buildStartDate = () => {
    if (form.start_month && form.start_year) {
      const m = MONTHS.indexOf(form.start_month as typeof MONTHS[number]) + 1;
      return `${form.start_year}-${String(m).padStart(2, '0')}-01`;
    }
    return null;
  };

  const buildEndDate = () => {
    if (form.is_current_role) return null;
    if (form.end_month && form.end_year) {
      const m = MONTHS.indexOf(form.end_month as typeof MONTHS[number]) + 1;
      return `${form.end_year}-${String(m).padStart(2, '0')}-01`;
    }
    return null;
  };

  const addExperience = async () => {
    if (!user?.id || !form.title.trim() || !form.company.trim()) return;
    setSaving(true);
    try {
      const start_date = buildStartDate();
      const end_date = buildEndDate();
      await supabase.from('accomplishments').insert({
        user_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        achieved_at: start_date,
        company: form.company.trim() || null,
        employment_type: form.employment_type || null,
        location: form.location.trim() || null,
        is_current_role: form.is_current_role,
        start_date,
        end_date,
        source_type: 'experience',
      });
      const { data } = await supabase
        .from('accomplishments')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false, nullsFirst: false })
        .order('achieved_at', { ascending: false });
      setAccomplishments((data as Accomplishment[]) ?? []);
      setForm({
        title: '',
        company: '',
        employment_type: '',
        description: '',
        is_current_role: true,
        start_month: '',
        start_year: '',
        end_month: '',
        end_year: '',
        location: '',
      });
      setShowAddExperience(false);
    } finally {
      setSaving(false);
    }
  };

  const deleteAccomplishment = async (id: string) => {
    if (!confirm('Remove this experience?')) return;
    await supabase.from('accomplishments').delete().eq('id', id);
    setAccomplishments((prev) => prev.filter((a) => a.id !== id));
  };

  // Viewing another user's profile (read-only)
  if (paramUserId && paramUserId !== user?.id) {
    if (viewProfile === undefined) return <div className="max-w-3xl mx-auto text-toptier-muted">Loading profile...</div>;
    if (viewProfile === null) return <div className="max-w-3xl mx-auto text-toptier-muted">User not found.</div>;
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>
        <div className="bg-toptier-surface rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="h-24 bg-gradient-to-r from-toptier-primary/25 via-toptier-pumpkin/20 to-toptier-amber/25" />
          <div className="px-6 pb-6 -mt-12 relative">
            <div className="w-24 h-24 rounded-full border-4 border-toptier-surface bg-gray-200 overflow-hidden flex items-center justify-center">
              {viewProfile.avatar_url ? (
                <img src={viewProfile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl text-gray-500">{viewProfile.full_name?.charAt(0) ?? '?'}</span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 mt-4">{viewProfile.full_name}</h2>
            <p className="text-toptier-muted">
              {POSITION_LABELS[viewProfile.position]}
              {viewProfile.employee_badge && (
                <span className="ml-1.5 text-gray-700">{EMPLOYEE_BADGE_LABELS[viewProfile.employee_badge as EmployeeBadge]}</span>
              )}
            </p>
            {(viewProfile.feed_points != null) && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-toptier-primary">Level {getFeedLevel(viewProfile.feed_points).level}</span>
                  <span
                    className="inline-flex text-gray-400 hover:text-gray-600 cursor-help"
                    title="Earn points by posting, commenting, and liking on the Feed. Every 100 points = 1 level. Higher levels show your activity and engagement."
                  >
                    <Info className="w-4 h-4" />
                  </span>
                  <span className="text-xs text-gray-500">({viewProfile.feed_points} pts)</span>
                </div>
                {getFeedLevel(viewProfile.feed_points).level < 100 && (
                  <div className="mt-1 w-32 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full rounded-full bg-toptier-primary" style={{ width: `${getFeedLevel(viewProfile.feed_points).progress * 100}%` }} />
                  </div>
                )}
              </div>
            )}
            <p className="text-toptier-muted text-sm mt-1">{viewProfile.email}</p>
            {(viewProfile.contact_number || viewProfile.emergency_contact_name || viewProfile.blood_type) && (
              <div className="mt-3 text-sm text-toptier-muted space-y-0.5">
                {viewProfile.contact_number && <p>Contact: {viewProfile.contact_number}</p>}
                {viewProfile.emergency_contact_name && <p>Emergency: {viewProfile.emergency_contact_name}{viewProfile.emergency_contact_number ? ` · ${viewProfile.emergency_contact_number}` : ''}</p>}
                {viewProfile.blood_type && <p>Blood type: {viewProfile.blood_type}</p>}
              </div>
            )}
            {viewProfile.bio && <p className="text-gray-300 mt-4">{viewProfile.bio}</p>}
          </div>
        </div>
        <div className="bg-toptier-surface rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Seminars and trainings</h3>
          {viewAccomplishments.filter((a) => a.source_type === 'pd').length === 0 ? (
            <p className="text-toptier-muted text-sm">No seminars or trainings yet.</p>
          ) : (
            <ul className="space-y-3">
              {viewAccomplishments.filter((a) => a.source_type === 'pd').map((a) => (
                <li key={a.id} className="p-3 rounded-lg bg-gray-100">
                  <p className="font-medium text-gray-900">{a.title}{a.company ? ` at ${a.company}` : ''}</p>
                  {a.employment_type && <p className="text-sm text-toptier-muted">{a.employment_type}</p>}
                  {a.description && <p className="text-sm text-toptier-muted mt-0.5">{a.description}</p>}
                  <p className="text-xs text-toptier-muted mt-1">
                    {formatExperienceDates(a)}
                    {a.location ? ` · ${a.location}` : ''}
                  </p>
                  {viewCertByAccId[a.id] && (
                    <Link to={`/certificate/${viewCertByAccId[a.id]}`} className="inline-flex items-center gap-1 mt-2 text-sm text-toptier-primary hover:underline">
                      <Award className="w-4 h-4" /> View certificate
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-toptier-surface rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Experience / Role</h3>
          {viewAccomplishments.filter((a) => a.source_type !== 'pd').length === 0 ? (
            <p className="text-toptier-muted text-sm">No experience listed.</p>
          ) : (
            <ul className="space-y-3">
              {viewAccomplishments.filter((a) => a.source_type !== 'pd').map((a) => (
                <li key={a.id} className="p-3 rounded-lg bg-gray-100">
                  <p className="font-medium text-gray-900">{a.title}{a.company ? ` at ${a.company}` : ''}</p>
                  {a.employment_type && <p className="text-sm text-toptier-muted">{a.employment_type}</p>}
                  {a.description && <p className="text-sm text-toptier-muted mt-0.5">{a.description}</p>}
                  <p className="text-xs text-toptier-muted mt-1">
                    {formatExperienceDates(a)}
                    {a.location ? ` · ${a.location}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-toptier-surface rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Skills</h3>
          {viewSkills.length === 0 ? <p className="text-toptier-muted text-sm">None listed.</p> : (
            <div className="flex flex-wrap gap-2">{viewSkills.map((s) => <span key={s.id} className="px-2 py-1 rounded bg-gray-200 text-gray-700 text-sm">{s.name}</span>)}</div>
          )}
        </div>
        <div className="bg-toptier-surface rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Interests</h3>
          {viewInterests.length === 0 ? <p className="text-toptier-muted text-sm">None listed.</p> : (
            <div className="flex flex-wrap gap-2">{viewInterests.map((i) => <span key={i.id} className="px-2 py-1 rounded bg-gray-200 text-gray-700 text-sm">{i.name}</span>)}</div>
          )}
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-3xl mx-auto min-w-0">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">My Profile</h1>

      <div className="bg-toptier-surface rounded-xl border border-gray-200 overflow-hidden mb-4 sm:mb-6">
        <div className="h-24 bg-gradient-to-r from-toptier-primary/25 via-toptier-pumpkin/20 to-toptier-amber/25" />
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 -mt-12 relative">
          <div className="w-24 h-24 rounded-full border-4 border-toptier-surface bg-gray-200 overflow-hidden flex items-center justify-center">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl text-gray-500">{profile.full_name?.charAt(0) ?? '?'}</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mt-4">{profile.full_name}</h2>
          <p className="text-toptier-muted">
            {POSITION_LABELS[profile.position]}
            {profile.employee_badge && (
              <span className="ml-1.5 text-gray-700">{EMPLOYEE_BADGE_LABELS[profile.employee_badge as EmployeeBadge]}</span>
            )}
          </p>
          {(profile.feed_points != null) && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-toptier-primary">Level {getFeedLevel(profile.feed_points).level}</span>
                <span
                  className="inline-flex text-gray-400 hover:text-gray-600 cursor-help"
                  title="Earn points by posting, commenting, and liking on the Feed. Every 100 points = 1 level. Higher levels show your activity and engagement."
                >
                  <Info className="w-4 h-4" />
                </span>
                <span className="text-xs text-gray-500">({profile.feed_points} pts)</span>
              </div>
              {getFeedLevel(profile.feed_points).level < 100 && (
                <div className="mt-1 w-32 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full rounded-full bg-toptier-primary" style={{ width: `${getFeedLevel(profile.feed_points).progress * 100}%` }} />
                </div>
              )}
            </div>
          )}
          <p className="text-toptier-muted text-sm mt-1">{profile.email}</p>
          {(profile.contact_number || profile.emergency_contact_name || profile.blood_type) && (
            <div className="mt-3 text-sm text-toptier-muted space-y-0.5">
              {profile.contact_number && <p>Contact: {profile.contact_number}</p>}
              {profile.emergency_contact_name && <p>Emergency: {profile.emergency_contact_name}{profile.emergency_contact_number ? ` · ${profile.emergency_contact_number}` : ''}</p>}
              {profile.blood_type && <p>Blood type: {profile.blood_type}</p>}
            </div>
          )}
          {profile.bio && <p className="text-gray-300 mt-4">{profile.bio}</p>}
        </div>
      </div>

      <div className="bg-toptier-surface rounded-xl border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Seminars and trainings</h3>
        {loading ? (
          <p className="text-toptier-muted">Loading...</p>
        ) : accomplishments.filter((a) => a.source_type === 'pd').length === 0 ? (
          <p className="text-toptier-muted text-sm">No seminars or trainings yet. Complete events from Professional Development to see them here.</p>
        ) : (
          <ul className="space-y-3">
            {accomplishments.filter((a) => a.source_type === 'pd').map((a) => (
              <li key={a.id} className="p-3 rounded-lg bg-gray-100">
                <p className="font-medium text-gray-900">{a.title}{a.company ? ` at ${a.company}` : ''}</p>
                {a.employment_type && <p className="text-sm text-toptier-muted">{a.employment_type}</p>}
                {a.description && <p className="text-sm text-toptier-muted mt-0.5">{a.description}</p>}
                <p className="text-xs text-toptier-muted mt-1">
                  {formatExperienceDates(a)}
                  {a.location ? ` · ${a.location}` : ''}
                </p>
                {certByAccId[a.id] && (
                  <Link to={`/certificate/${certByAccId[a.id]}`} className="inline-flex items-center gap-1 mt-2 text-sm text-toptier-primary hover:underline">
                    <Award className="w-4 h-4" /> View certificate
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-toptier-surface rounded-xl border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="font-semibold text-gray-900">Experience / Role</h3>
          <button
            type="button"
            onClick={() => setShowAddExperience(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-toptier-primary hover:bg-toptier-primary-hover text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add experience
          </button>
        </div>

        {showAddExperience && (
          <div className="mb-6 p-5 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">Add experience</h4>
              <button
                type="button"
                onClick={() => setShowAddExperience(false)}
                className="p-1.5 rounded-lg text-toptier-muted hover:text-gray-900 hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-toptier-muted mb-3">* Indicates required</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Retail Sales Manager"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Employment type</label>
                <select
                  value={form.employment_type}
                  onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900"
                >
                  <option value="">Please select</option>
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Company or organization *</label>
                <input
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="Ex: Microsoft"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-500"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_current_role}
                  onChange={(e) => setForm((f) => ({ ...f, is_current_role: e.target.checked }))}
                  className="rounded border-gray-300 bg-white text-toptier-primary focus:ring-toptier-primary"
                />
                <span className="text-sm text-gray-300">I am currently working in this role</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Start month *</label>
                  <select
                    value={form.start_month}
                    onChange={(e) => setForm((f) => ({ ...f, start_month: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900"
                  >
                    <option value="">Month</option>
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Start year *</label>
                  <select
                    value={form.start_year}
                    onChange={(e) => setForm((f) => ({ ...f, start_year: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900"
                  >
                    <option value="">Year</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              {!form.is_current_role && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">End month</label>
                    <select
                      value={form.end_month}
                      onChange={(e) => setForm((f) => ({ ...f, end_month: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900"
                    >
                      <option value="">Month</option>
                      {MONTHS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">End year</label>
                    <select
                      value={form.end_year}
                      onChange={(e) => setForm((f) => ({ ...f, end_year: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900"
                    >
                      <option value="">Year</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-300 mb-1">Location</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="City, Country"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Description (optional)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={addExperience}
                disabled={saving || !form.title.trim() || !form.company.trim()}
                className="px-4 py-2 rounded-lg bg-toptier-primary hover:bg-toptier-primary-hover text-white text-sm font-medium disabled:opacity-50 transition"
              >
                Save
              </button>
              <button
                onClick={() => setShowAddExperience(false)}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-toptier-muted">Loading...</p>
        ) : accomplishments.filter((a) => a.source_type !== 'pd').length === 0 ? (
          <p className="text-toptier-muted text-sm">No experience yet. Click &quot;Add experience&quot; above to add a role or job.</p>
        ) : (
          <ul className="space-y-3">
            {accomplishments.filter((a) => a.source_type !== 'pd').map((a) => (
              <li key={a.id} className="flex justify-between items-start p-3 rounded-lg bg-gray-100">
                <div>
                  <p className="font-medium text-gray-900">{a.title}{a.company ? ` at ${a.company}` : ''}</p>
                  {a.employment_type && <p className="text-sm text-toptier-muted">{a.employment_type}</p>}
                  {a.description && <p className="text-sm text-toptier-muted mt-0.5">{a.description}</p>}
                  <p className="text-xs text-toptier-muted mt-1">
                    {formatExperienceDates(a)}
                    {a.location ? ` · ${a.location}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteAccomplishment(a.id)}
                  className="p-1.5 rounded text-toptier-muted hover:text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Skills</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {skills.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-200 text-gray-700 text-sm">
                {s.name}
                <button type="button" onClick={() => deleteSkill(s.id)} className="rounded hover:bg-gray-200 p-0.5 text-toptier-muted hover:text-gray-900">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSkill()} placeholder="Add skill" className="flex-1 px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 text-sm" />
            <button type="button" onClick={addSkill} disabled={!newSkill.trim()} className="px-3 py-2 rounded-lg bg-toptier-primary hover:bg-toptier-primary-hover text-white text-sm disabled:opacity-50 transition">Add</button>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Interests</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {interests.map((i) => (
              <span key={i.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-200 text-gray-700 text-sm">
                {i.name}
                <button type="button" onClick={() => deleteInterest(i.id)} className="rounded hover:bg-gray-200 p-0.5 text-toptier-muted hover:text-gray-900">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newInterest} onChange={(e) => setNewInterest(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addInterest()} placeholder="Add interest" className="flex-1 px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 text-sm" />
            <button type="button" onClick={addInterest} disabled={!newInterest.trim()} className="px-3 py-2 rounded-lg bg-toptier-primary hover:bg-toptier-primary-hover text-white text-sm disabled:opacity-50 transition">Add</button>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <ProfilePDF profile={profile} accomplishments={accomplishments} />
        </div>
      </div>
    </div>
  );
}

function formatExperienceDates(a: Accomplishment): string {
  const start = a.start_date ? format(parseISO(a.start_date), 'MMM yyyy') : null;
  const end = a.is_current_role === true ? 'Present' : (a.end_date ? format(parseISO(a.end_date), 'MMM yyyy') : null);
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (a.achieved_at) return format(parseISO(a.achieved_at), 'MMM d, yyyy');
  return '';
}
