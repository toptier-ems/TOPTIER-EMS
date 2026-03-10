import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  APPLICANT_STATUS_LABELS,
  type Applicant,
  type ApplicantStatus,
} from '../types/database';
import { logAction } from '../lib/actionLog';
import { format } from 'date-fns';
import { Plus, Trash2, X, FileText, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const RESUMES_BUCKET = 'resumes';
const ALLOWED_ROLES = ['ceo', 'executive', 'manager', 'trainer', 'supervisor', 'hr'];

const STATUS_OPTIONS: ApplicantStatus[] = ['initial_interview', 'training', 'final_interview', 'failed', 'hired'];

export default function RecruitmentPage() {
  const { user, profile } = useAuth();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    position_applied_for: '',
    age: '',
    experience: '',
    educational_attainment: '',
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const canAccess = profile && ALLOWED_ROLES.includes(profile.position);

  useEffect(() => {
    if (!canAccess) return;
    (async () => {
      const { data } = await supabase
        .from('applicants')
        .select('*')
        .order('created_at', { ascending: false });
      setApplicants((data as Applicant[]) ?? []);
    })();
    setLoading(false);
  }, [canAccess]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (accepted) => setResumeFile(accepted[0] ?? null),
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: saving,
  });

  const uploadResume = async (): Promise<string | null> => {
    if (!resumeFile || !user?.id) return null;
    const ext = resumeFile.name.split('.').pop() || 'pdf';
    const path = `${user.id}/${Date.now()}.${ext}`;
    await supabase.storage.from(RESUMES_BUCKET).upload(path, resumeFile, { upsert: true });
    const { data } = supabase.storage.from(RESUMES_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const addApplicant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.position_applied_for.trim() || saving) return;
    setSaving(true);
    try {
      const resume_url = await uploadResume();
      const { data, error } = await supabase
        .from('applicants')
        .insert({
          name: form.name.trim(),
          position_applied_for: form.position_applied_for.trim(),
          age: form.age ? parseInt(form.age, 10) : null,
          experience: form.experience.trim() || null,
          educational_attainment: form.educational_attainment.trim() || null,
          resume_url: resume_url || null,
          status: 'initial_interview',
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (error) throw error;
      const applicant = data as Applicant;
      setApplicants((prev) => [applicant, ...prev]);
      setForm({ name: '', position_applied_for: '', age: '', experience: '', educational_attainment: '' });
      setResumeFile(null);
      setShowForm(false);
      if (user?.id) await logAction(user.id, 'recruitment_add', `Added applicant: ${applicant.name} (${applicant.position_applied_for})`, applicant.id);
    } catch (err) {
      console.error(err);
      alert('Failed to add applicant.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: ApplicantStatus) => {
    const applicant = applicants.find((a) => a.id === id);
    await supabase
      .from('applicants')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    setApplicants((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    if (user?.id && applicant) await logAction(user.id, 'recruitment_status', `Changed ${applicant.name} status to ${APPLICANT_STATUS_LABELS[status]}`, id);
  };

  const deleteApplicant = async (id: string) => {
    if (!confirm('Delete this applicant? This cannot be undone.')) return;
    const applicant = applicants.find((a) => a.id === id);
    setDeletingId(id);
    try {
      await supabase.from('applicants').delete().eq('id', id);
      setApplicants((prev) => prev.filter((a) => a.id !== id));
      if (user?.id && applicant) await logAction(user.id, 'recruitment_delete', `Deleted applicant: ${applicant.name}`, id);
    } finally {
      setDeletingId(null);
    }
  };

  if (!canAccess) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Recruitment</h1>
        <p className="text-gray-600">Only CEO, Executive, Manager, Trainer, Supervisor, and HR can access this page.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-6">Recruitment / Hiring</h1>
      <p className="text-gray-600 text-sm sm:text-base mb-4 sm:mb-6">Manage applicants and their status in the hiring pipeline.</p>

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-toptier-primary hover:bg-toptier-primary-hover text-white font-medium transition"
        >
          <Plus className="w-4 h-4" /> Add Applicant
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={() => !saving && setShowForm(false)}>
          <div
            className="bg-white w-full sm:max-w-lg max-h-[85dvh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl shadow-modal border border-gray-200 p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Add Applicant</h2>
              <button type="button" onClick={() => !saving && setShowForm(false)} className="p-1 rounded text-gray-500 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={addApplicant} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position Applied For *</label>
                <input
                  value={form.position_applied_for}
                  onChange={(e) => setForm((f) => ({ ...f, position_applied_for: e.target.value }))}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
                  placeholder="e.g. Software Engineer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                <input
                  type="number"
                  min={18}
                  value={form.age}
                  onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
                  placeholder="Age"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Experience</label>
                <textarea
                  value={form.experience}
                  onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary resize-none"
                  placeholder="Previous roles, years, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Educational Attainment</label>
                <textarea
                  value={form.educational_attainment}
                  onChange={(e) => setForm((f) => ({ ...f, educational_attainment: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary resize-none"
                  placeholder="Degree, school, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resume (PDF)</label>
                <div
                  {...getRootProps()}
                  className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-toptier-primary hover:bg-toptier-primary/5 transition"
                >
                  <input {...getInputProps()} />
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">
                    {resumeFile ? resumeFile.name : 'Drop PDF here or click to select'}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => !saving && setShowForm(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-toptier-primary hover:bg-toptier-primary-hover text-white font-medium disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Add Applicant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : applicants.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No applicants yet. Add one to get started.</div>
        ) : (
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-left min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-900 text-sm">Name</th>
                  <th className="py-3 px-4 font-semibold text-gray-900">Position Applied For</th>
                  <th className="py-3 px-4 font-semibold text-gray-900">Age</th>
                  <th className="py-3 px-4 font-semibold text-gray-900">Experience</th>
                  <th className="py-3 px-4 font-semibold text-gray-900">Educational Attainment</th>
                  <th className="py-3 px-4 font-semibold text-gray-900">Resume</th>
                  <th className="py-3 px-4 font-semibold text-gray-900">Status</th>
                  <th className="py-3 px-4 font-semibold text-gray-900">Date Added</th>
                  <th className="py-3 px-4 font-semibold text-gray-900 w-20">Action</th>
                </tr>
              </thead>
              <tbody>
                {applicants.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-medium text-gray-900">{a.name}</td>
                    <td className="py-3 px-4 text-gray-700">{a.position_applied_for}</td>
                    <td className="py-3 px-4 text-gray-600">{a.age ?? '—'}</td>
                    <td className="py-3 px-4 text-gray-600 max-w-[200px] truncate" title={a.experience ?? ''}>{a.experience || '—'}</td>
                    <td className="py-3 px-4 text-gray-600 max-w-[200px] truncate" title={a.educational_attainment ?? ''}>{a.educational_attainment || '—'}</td>
                    <td className="py-3 px-4">
                      {a.resume_url ? (
                        <a
                          href={a.resume_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-toptier-primary hover:underline text-sm"
                        >
                          <FileText className="w-4 h-4" /> PDF
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={a.status}
                        onChange={(e) => updateStatus(a.id, e.target.value as ApplicantStatus)}
                        className="px-2 py-1 rounded border border-gray-200 text-gray-900 text-sm focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary bg-white"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{APPLICANT_STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm">{format(new Date(a.created_at), 'MMM d, yyyy')}</td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => deleteApplicant(a.id)}
                        disabled={deletingId === a.id}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                        title="Delete applicant"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
