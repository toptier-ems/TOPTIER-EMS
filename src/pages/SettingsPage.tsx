import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { POSITION_LABELS, LEAVE_TYPE_LABELS } from '../types/database';
import type { LeaveType } from '../types/database';
import type { LeaveAllocation, LeaveRequest } from '../types/database';
import { BLOOD_TYPES } from '../types/database';
import { useDropzone } from 'react-dropzone';
import { Camera, Calendar } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';

const AVATAR_BUCKET = 'avatars';
const currentYear = new Date().getFullYear();

function leaveDaysUsed(requests: LeaveRequest[], type: LeaveType): number {
  return requests
    .filter((r) => r.leave_type === type && r.status === 'approved')
    .reduce((sum, r) => sum + differenceInCalendarDays(new Date(r.end_date), new Date(r.start_date)) + 1, 0);
}

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [bio, setBio] = useState('');
  const [address, setAddress] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [allocation, setAllocation] = useState<LeaveAllocation | null>(null);
  const [approvedRequests, setApprovedRequests] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setContactNumber(profile?.contact_number ?? '');
    setEmergencyContactName(profile?.emergency_contact_name ?? '');
    setEmergencyContactNumber(profile?.emergency_contact_number ?? '');
    setBloodType(profile?.blood_type ?? '');
    setBio(profile?.bio ?? '');
    setAddress(profile?.address ?? '');
    setBirthDate(profile?.birth_date ?? '');
  }, [profile]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const [allocRes, reqRes] = await Promise.all([
        supabase.from('leave_allocations').select('*').eq('user_id', user.id).eq('year', currentYear).maybeSingle(),
        supabase.from('leave_requests').select('*').eq('user_id', user.id).eq('status', 'approved'),
      ]);
      setAllocation((allocRes.data as LeaveAllocation) ?? null);
      const list = (reqRes.data ?? []).filter((r: LeaveRequest) => {
        const y = new Date(r.start_date).getFullYear();
        return y === currentYear;
      }) as LeaveRequest[];
      setApprovedRequests(list);
    })();
  }, [user?.id]);

  const uploadAvatar = async (file: File) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar.${ext}`;
      await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: true });
      const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      await supabase.from('profiles').update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() }).eq('id', user.id);
      await refreshProfile();
    } finally {
      setSaving(false);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (accepted) => accepted.length && uploadAvatar(accepted[0]),
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    disabled: saving,
  });

  const saveProfile = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || profile?.full_name,
          contact_number: contactNumber.trim() || null,
          emergency_contact_name: emergencyContactName.trim() || null,
          emergency_contact_number: emergencyContactNumber.trim() || null,
          blood_type: bloodType || null,
          bio: bio.trim() || null,
          address: address.trim() || null,
          birth_date: birthDate || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      await refreshProfile();
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-2xl mx-auto min-w-0 px-0 sm:px-0">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      <p className="text-toptier-muted mb-6">Edit your information. Your profile page shows the final output to others.</p>

      <div className="bg-toptier-surface rounded-card border border-gray-200 p-6 space-y-5 shadow-card">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Profile picture</label>
          <div
            {...getRootProps()}
            className="w-24 h-24 rounded-full border-2 border-dashed border-gray-200 bg-gray-100 overflow-hidden cursor-pointer hover:border-toptier-primary hover:bg-toptier-primary/5 transition flex items-center justify-center"
          >
            <input {...getInputProps()} />
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-10 h-10 text-toptier-muted" />
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
          />
        </div>

        <p className="text-sm text-toptier-muted">Email and position cannot be changed here.</p>
        <p className="text-sm text-toptier-muted">{profile.email} · {POSITION_LABELS[profile.position]}</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact number</label>
          <input
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            placeholder="+63..."
            className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Emergency contact person</label>
          <input
            value={emergencyContactName}
            onChange={(e) => setEmergencyContactName(e.target.value)}
            placeholder="Name"
            className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Emergency contact number</label>
          <input
            value={emergencyContactNumber}
            onChange={(e) => setEmergencyContactNumber(e.target.value)}
            placeholder="+63..."
            className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Full address"
            className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Birth date</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
          />
          <p className="text-xs text-gray-500 mt-0.5">Used for birthdays on Team Calendar (optional).</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Blood type</label>
          <select
            value={bloodType}
            onChange={(e) => setBloodType(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
          >
            <option value="">Select</option>
            {BLOOD_TYPES.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="Short bio..."
            className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-500 resize-none focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
          />
        </div>

        <button
          type="button"
          onClick={saveProfile}
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-toptier-primary hover:bg-toptier-primary-hover text-white font-medium disabled:opacity-50 transition"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>

      <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6 shadow-card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-toptier-primary" />
          Leave balance {currentYear}
        </h2>
        <p className="text-sm text-gray-600 mb-4">Allocated by CEO/HR. Approved leave requests reduce your balance.</p>
        {!allocation ? (
          <p className="text-sm text-gray-500">No leave allocation set for this year yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600">
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Allocated</th>
                  <th className="py-2 pr-4 font-medium">Used</th>
                  <th className="py-2 font-medium">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {(['vacation', 'sick', 'emergency'] as LeaveType[]).map((type) => {
                  const alloc = type === 'vacation' ? allocation.vacation_days : type === 'sick' ? allocation.sick_days : allocation.emergency_days;
                  const used = leaveDaysUsed(approvedRequests, type);
                  const remaining = Math.max(0, alloc - used);
                  return (
                    <tr key={type} className="border-b border-gray-100">
                      <td className="py-2 pr-4 text-gray-900">{LEAVE_TYPE_LABELS[type]}</td>
                      <td className="py-2 pr-4 text-gray-700">{alloc}</td>
                      <td className="py-2 pr-4 text-gray-700">{used}</td>
                      <td className="py-2 font-medium text-toptier-primary">{remaining}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
