import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { POSITION_LABELS } from '../types/database';
import type { Profile } from '../types/database';
import type { LeaveAllocation } from '../types/database';
import { logAction } from '../lib/actionLog';

const ALLOWED_ROLES = ['ceo', 'hr'];
const currentYear = new Date().getFullYear();

export default function LeaveAllocationPage() {
  const { user, profile } = useAuth();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [allocations, setAllocations] = useState<Record<string, LeaveAllocation>>({});
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);

  const canAccess = profile && ALLOWED_ROLES.includes(profile.position);

  useEffect(() => {
    if (!canAccess) return;
    (async () => {
      const { data: profData } = await supabase.from('profiles').select('*').eq('approval_status', 'approved').is('deleted_at', null).order('full_name');
      setEmployees((profData as Profile[]) ?? []);
      const { data: allocData } = await supabase.from('leave_allocations').select('*').eq('year', year);
      const map: Record<string, LeaveAllocation> = {};
      (allocData as LeaveAllocation[] ?? []).forEach((a) => {
        map[a.user_id] = a;
      });
      setAllocations(map);
    })();
    setLoading(false);
  }, [canAccess, year]);

  const upsert = async (userId: string, vacation: number, sick: number, emergency: number) => {
    await supabase.from('leave_allocations').upsert(
      {
        user_id: userId,
        year,
        vacation_days: vacation,
        sick_days: sick,
        emergency_days: emergency,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,year' }
    );
    const { data } = await supabase.from('leave_allocations').select('*').eq('user_id', userId).eq('year', year).single();
    if (data) setAllocations((prev) => ({ ...prev, [userId]: data as LeaveAllocation }));
    const employee = employees.find((e) => e.id === userId);
    if (user?.id && employee) await logAction(user.id, 'leave_allocation_set', `Set leave allocation for ${employee.full_name} (${year}): Vacation ${vacation}, Sick ${sick}, Emergency ${emergency}`, userId);
  };

  if (!canAccess) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Leave Allocation</h1>
        <p className="text-gray-600">Only HR and CEO can access this page.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Leave Allocation</h1>
      <p className="text-gray-600 mb-4">Set the number of leave days per employee per year.</p>
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700 mr-2">Year</label>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900"
        >
          {[currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <p className="text-gray-600">Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600 text-sm">
                <th className="py-2 pr-4">Employee</th>
                <th className="py-2 pr-4">Position</th>
                <th className="py-2 pr-4">Vacation</th>
                <th className="py-2 pr-4">Sick</th>
                <th className="py-2 pr-4">Emergency</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <AllocationRow
                  key={emp.id}
                  employee={emp}
                  allocation={allocations[emp.id]}
                  onSave={(v, s, e) => upsert(emp.id, v, s, e)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AllocationRow({
  employee,
  allocation,
  onSave,
}: {
  employee: Profile;
  allocation?: LeaveAllocation;
  onSave: (vacation: number, sick: number, emergency: number) => void;
}) {
  const [vacation, setVacation] = useState(allocation?.vacation_days ?? 0);
  const [sick, setSick] = useState(allocation?.sick_days ?? 0);
  const [emergency, setEmergency] = useState(allocation?.emergency_days ?? 0);

  useEffect(() => {
    setVacation(allocation?.vacation_days ?? 0);
    setSick(allocation?.sick_days ?? 0);
    setEmergency(allocation?.emergency_days ?? 0);
  }, [allocation]);

  return (
    <tr className="border-b border-gray-200">
      <td className="py-2 pr-4 text-gray-900">{employee.full_name}</td>
      <td className="py-2 pr-4 text-gray-600">{POSITION_LABELS[employee.position]}</td>
      <td className="py-2 pr-4">
        <input
          type="number"
          min={0}
          value={vacation}
          onChange={(e) => setVacation(Number(e.target.value))}
          className="w-16 px-2 py-1 rounded bg-white border border-gray-200 text-gray-900 text-sm"
        />
      </td>
      <td className="py-2 pr-4">
        <input
          type="number"
          min={0}
          value={sick}
          onChange={(e) => setSick(Number(e.target.value))}
          className="w-16 px-2 py-1 rounded bg-white border border-gray-200 text-gray-900 text-sm"
        />
      </td>
      <td className="py-2 pr-4">
        <input
          type="number"
          min={0}
          value={emergency}
          onChange={(e) => setEmergency(Number(e.target.value))}
          className="w-16 px-2 py-1 rounded bg-white border border-gray-200 text-gray-900 text-sm"
        />
      </td>
      <td className="py-2">
        <button
          type="button"
          onClick={() => onSave(vacation, sick, emergency)}
          className="px-3 py-1 rounded bg-toptier-primary text-white text-sm"
        >
          Save
        </button>
      </td>
    </tr>
  );
}
