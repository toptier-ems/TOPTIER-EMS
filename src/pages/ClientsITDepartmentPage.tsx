import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  IT_TASK_STATUS_LABELS,
  IT_TASK_PRIORITY_LABELS,
  type ITTaskStatus,
  type ITTaskPriority,
  type ITDepartmentTask,
  type ITDepartmentTaskWithDetails,
  type ITDepartmentClient,
  type ITDepartmentSubtask,
  type ITDepartmentActivity,
  type ITDepartmentComment,
  type Profile,
} from '../types/database';
import { format, startOfToday, parseISO, isToday, subDays, startOfDay } from 'date-fns';
import {
  Plus,
  X,
  Calendar,
  Flag,
  User,
  MessageSquare,
  ListTodo,
  GripVertical,
  Search,
  Filter,
  Trash2,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  FileText,
  Pencil,
  Target,
} from 'lucide-react';

const STATUS_ORDER: ITTaskStatus[] = ['todo', 'in_progress', 'review', 'completed'];
const PRIORITY_OPTIONS: (ITTaskPriority | '')[] = ['', 'low', 'normal', 'high', 'urgent'];
const CLIENT_CONTRACTS_BUCKET = 'client-contracts';
const CONTRACT_ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-toptier-primary/20 text-toptier-primary text-xs font-medium flex-shrink-0 ${className ?? 'w-8 h-8'}`}
      title={name}
    >
      {initials}
    </div>
  );
}

export default function ClientsITDepartmentPage() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<ITDepartmentTaskWithDetails[]>([]);
  const [clients, setClients] = useState<ITDepartmentClient[]>([]);
  const [itMembers, setItMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    status: 'todo' as ITTaskStatus,
    priority: '' as ITTaskPriority | '',
    due_date: '',
    client_id: '',
    assignee_ids: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', contact: '', company: '' });
  const [yesterdayActivity, setYesterdayActivity] = useState<(ITDepartmentActivity & { profiles?: Pick<Profile, 'full_name'> | null })[]>([]);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editClientForm, setEditClientForm] = useState({
    objectives_target: '',
    objectives_done: '',
    due_date: '',
  });
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [uploadingContract, setUploadingContract] = useState(false);
  const contractInputRef = useRef<HTMLInputElement>(null);

  const canAccess = profile?.department === 'it' || profile?.department === 'executive' || profile?.position === 'executive';
  const canRemoveClient = profile?.position === 'executive' || profile?.department === 'executive';

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    const todayStart = startOfToday();
    const yesterdayStart = startOfDay(subDays(todayStart, 1));
    const yesterdayStartIso = yesterdayStart.toISOString();
    const todayStartIso = todayStart.toISOString();
    (async () => {
      const [tasksRes, clientsRes, membersRes, activityRes] = await Promise.all([
        supabase
          .from('it_department_tasks')
          .select(`
            *,
            it_department_task_assignees(user_id),
            it_department_clients(id, name, company)
          `)
          .order('updated_at', { ascending: false }),
        supabase.from('it_department_clients').select('*').order('name'),
        supabase.from('profiles').select('id, full_name, avatar_url').eq('department', 'it').eq('approval_status', 'approved').order('full_name'),
        supabase
          .from('it_department_activity')
          .select('*, profiles!user_id(full_name)')
          .gte('created_at', yesterdayStartIso)
          .lt('created_at', todayStartIso)
          .order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;

      const taskRows = (tasksRes.data ?? []) as (ITDepartmentTask & {
        it_department_task_assignees?: { user_id: string }[];
        it_department_clients?: ITDepartmentClient | null;
      })[];
      const assigneeIds = new Set<string>();
      taskRows.forEach((t) => t.it_department_task_assignees?.forEach((a) => assigneeIds.add(a.user_id)));
      const memberIds = new Set((membersRes.data ?? []).map((m: { id: string }) => m.id));
      const allAssigneeIds = [...new Set([...assigneeIds, ...memberIds])];
      let assigneeProfiles: Profile[] = [];
      if (allAssigneeIds.length > 0) {
        const { data: assigneeData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', allAssigneeIds);
        assigneeProfiles = (assigneeData ?? []) as Profile[];
      }
      const profileMap = Object.fromEntries(assigneeProfiles.map((p) => [p.id, p]));

      setTasks(
        taskRows.map((t) => ({
          ...t,
          assignees: (t.it_department_task_assignees ?? []).map((a) => profileMap[a.user_id]).filter(Boolean),
          client: t.it_department_clients ?? null,
        }))
      );
      setClients((clientsRes.data ?? []) as ITDepartmentClient[]);
      setItMembers((membersRes.data ?? []) as Profile[]);
      setYesterdayActivity((activityRes.data ?? []) as (ITDepartmentActivity & { profiles?: Pick<Profile, 'full_name'> | null })[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [canAccess]);

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.toLowerCase().trim();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.client?.name?.toLowerCase().includes(q) ||
        t.assignees?.some((a) => a.full_name?.toLowerCase().includes(q))
    );
  }, [tasks, search]);

  const tasksByStatus = useMemo(() => {
    const map: Record<ITTaskStatus, ITDepartmentTaskWithDetails[]> = {
      todo: [],
      in_progress: [],
      review: [],
      completed: [],
    };
    filteredTasks.forEach((t) => map[t.status].push(t));
    return map;
  }, [filteredTasks]);

  const statsCards = useMemo(() => {
    const today = startOfToday();
    const completedToday = tasks.filter(
      (t) => t.status === 'completed' && t.updated_at && isToday(parseISO(t.updated_at))
    ).length;
    const pending = tasks.filter((t) => t.status === 'in_progress' || t.status === 'review').length;
    const overdueTodo = tasks.filter((t) => {
      if (t.status === 'completed') return false;
      if (!t.due_date) return false;
      const due = parseISO(t.due_date);
      return due < today;
    }).length;
    return {
      completedToday,
      totalClients: clients.length,
      pending,
      overdueTodo,
    };
  }, [tasks, clients.length]);

  const yesterdaySummary = useMemo(() => {
    const created = yesterdayActivity.filter((a) => a.action_type === 'created').length;
    const statusChanges = yesterdayActivity.filter((a) => a.action_type === 'status_change');
    const toCompleted = statusChanges.filter((a) => a.details?.includes('to Completed')).length;
    const toInProgress = statusChanges.filter((a) => a.details?.includes('to In Progress')).length;
    const toReview = statusChanges.filter((a) => a.details?.includes('to Review')).length;
    const toTodo = statusChanges.filter((a) => a.details?.includes('to To Do')).length;
    const comments = yesterdayActivity.filter((a) => a.action_type === 'comment').length;
    const subtasksAdded = yesterdayActivity.filter((a) => a.action_type === 'subtask_added').length;
    const taskIds = new Set(yesterdayActivity.map((a) => a.task_id));
    const peopleFromActivity = new Set(
      yesterdayActivity.map((a) => (a.profiles as { full_name?: string } | null)?.full_name).filter(Boolean)
    ) as Set<string>;
    tasks.forEach((t) => {
      if (taskIds.has(t.id) && t.assignees) t.assignees.forEach((a) => peopleFromActivity.add(a.full_name ?? ''));
    });
    const people = [...peopleFromActivity].filter(Boolean).sort();
    const yesterdayStr = format(subDays(startOfToday(), 1), 'MMMM d, yyyy');
    return {
      yesterdayStr,
      created,
      toCompleted,
      toInProgress,
      toReview,
      toTodo,
      comments,
      subtasksAdded,
      people,
      totalActions: yesterdayActivity.length,
    };
  }, [yesterdayActivity, tasks]);

  const removeClient = async (clientId: string) => {
    if (!canRemoveClient || !confirm('Remove this client? Tasks linked to them will keep the client reference cleared.')) return;
    setDeletingClientId(clientId);
    try {
      await supabase.from('it_department_clients').delete().eq('id', clientId);
      setClients((prev) => prev.filter((c) => c.id !== clientId));
      setTasks((prev) =>
        prev.map((t) => (t.client_id === clientId ? { ...t, client_id: null, client: null } : t))
      );
    } catch (err) {
      console.error(err);
      alert('Failed to remove client. Only Executives can remove clients.');
    } finally {
      setDeletingClientId(null);
    }
  };

  const openEditClient = (c: ITDepartmentClient) => {
    setEditingClientId(c.id);
    setEditClientForm({
      objectives_target: c.objectives_target != null ? String(c.objectives_target) : '',
      objectives_done: c.objectives_done != null ? String(c.objectives_done) : '',
      due_date: c.due_date ?? '',
    });
    setContractFile(null);
  };

  const saveEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClientId || uploadingContract) return;
    const client = clients.find((x) => x.id === editingClientId);
    if (!client) return;
    setUploadingContract(true);
    try {
      let contract_url: string | null = client.contract_url ?? null;
      if (contractFile) {
        const ext = contractFile.name.split('.').pop() || 'pdf';
        const path = `${client.id}/${Date.now()}.${ext}`;
        await supabase.storage.from(CLIENT_CONTRACTS_BUCKET).upload(path, contractFile, { upsert: true });
        const { data } = supabase.storage.from(CLIENT_CONTRACTS_BUCKET).getPublicUrl(path);
        contract_url = data.publicUrl;
      }
      const objectives_target = editClientForm.objectives_target ? parseInt(editClientForm.objectives_target, 10) : null;
      const objectives_done = editClientForm.objectives_done ? parseInt(editClientForm.objectives_done, 10) : null;
      const due_date = editClientForm.due_date || null;
      const payload: Record<string, unknown> = {
        objectives_target,
        objectives_done,
        due_date,
        updated_at: new Date().toISOString(),
      };
      if (contractFile) {
        payload.contract_url = contract_url;
      } else if (contract_url !== undefined) {
        payload.contract_url = contract_url;
      }
      const { data: updated, error } = await supabase
        .from('it_department_clients')
        .update(payload)
        .eq('id', editingClientId)
        .select('*')
        .single();
      if (error) {
        throw error;
      }
      if (updated) {
        setClients((prev) => prev.map((c) => (c.id === editingClientId ? (updated as ITDepartmentClient) : c)));
      }
      setEditingClientId(null);
      setContractFile(null);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to save. For contract, use PDF or .docx under 10MB.');
    } finally {
      setUploadingContract(false);
    }
  };

  const removeContract = async (clientId: string) => {
    const client = clients.find((x) => x.id === clientId);
    if (!client?.contract_url || !confirm('Remove contract file?')) return;
    try {
      await supabase.from('it_department_clients').update({ contract_url: null, updated_at: new Date().toISOString() }).eq('id', clientId);
      setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, contract_url: null, updated_at: new Date().toISOString() } : c)));
      if (editingClientId === clientId) setEditingClientId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name.trim() || saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('it_department_clients')
        .insert({
          name: newClient.name.trim(),
          contact: newClient.contact.trim() || null,
          company: newClient.company.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (error) throw error;
      setClients((prev) => [data as ITDepartmentClient, ...prev]);
      setNewClient({ name: '', contact: '', company: '' });
      setShowAddClientModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to add client.');
    } finally {
      setSaving(false);
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim() || !user?.id || saving) return;
    setSaving(true);
    try {
      const { data: task, error: taskErr } = await supabase
        .from('it_department_tasks')
        .insert({
          title: createForm.title.trim(),
          description: createForm.description.trim() || null,
          status: createForm.status,
          priority: createForm.priority || null,
          due_date: createForm.due_date || null,
          client_id: createForm.client_id || null,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (taskErr) throw taskErr;
      if (createForm.assignee_ids.length > 0) {
        await supabase.from('it_department_task_assignees').insert(
          createForm.assignee_ids.map((user_id) => ({ task_id: (task as ITDepartmentTask).id, user_id }))
        );
      }
      await supabase.from('it_department_activity').insert({
        task_id: (task as ITDepartmentTask).id,
        user_id: user.id,
        action_type: 'created',
        details: 'Created this task',
      });
      const newTask: ITDepartmentTaskWithDetails = {
        ...(task as ITDepartmentTask),
        assignees: itMembers.filter((m) => createForm.assignee_ids.includes(m.id)),
        client: clients.find((c) => c.id === createForm.client_id) ?? null,
      };
      setTasks((prev) => [newTask, ...prev]);
      setCreateForm({ title: '', description: '', status: 'todo', priority: '', due_date: '', client_id: '', assignee_ids: [] });
      setShowCreateModal(false);
      setSelectedTaskId((task as ITDepartmentTask).id);
    } catch (err) {
      console.error(err);
      alert('Failed to create task.');
    } finally {
      setSaving(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: ITTaskStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    const oldStatus = task?.status;
    await supabase
      .from('it_department_tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', taskId);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    if (user?.id && oldStatus)
      await supabase.from('it_department_activity').insert({
        task_id: taskId,
        user_id: user.id,
        action_type: 'status_change',
        details: `Changed status from ${IT_TASK_STATUS_LABELS[oldStatus]} to ${IT_TASK_STATUS_LABELS[status]}`,
      });
  };

  if (!canAccess) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Clients IT Department</h1>
        <p className="text-gray-600">Only IT Department members, Executive Department members, and Executives can access this page. Ask HR to assign your department on Total Employees.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clients IT Department</h1>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-toptier-primary text-white font-medium hover:bg-toptier-primary-hover transition"
        >
          <Plus className="w-5 h-5" />
          Task
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5 hover:shadow-md transition-shadow overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-bl-full" aria-hidden />
          <div className="flex items-start gap-4 relative">
            <div className="p-3 rounded-xl bg-green-100 text-green-600">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Completed Today</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{statsCards.completedToday}</p>
              <p className="text-xs text-gray-400 mt-1">tasks finished today</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5 hover:shadow-md transition-shadow overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-toptier-primary/10 rounded-bl-full" aria-hidden />
          <div className="flex items-start gap-4 relative">
            <div className="p-3 rounded-xl bg-toptier-primary/15 text-toptier-primary">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Clients</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{statsCards.totalClients}</p>
              <p className="text-xs text-gray-400 mt-1">active clients</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5 hover:shadow-md transition-shadow overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-full" aria-hidden />
          <div className="flex items-start gap-4 relative">
            <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{statsCards.pending}</p>
              <p className="text-xs text-gray-400 mt-1">in progress or in review</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5 hover:shadow-md transition-shadow overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-bl-full" aria-hidden />
          <div className="flex items-start gap-4 relative">
            <div className="p-3 rounded-xl bg-amber-100 text-amber-600">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Overdue To Do</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{statsCards.overdueTodo}</p>
              <p className="text-xs text-gray-400 mt-1">past due, not finished</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks, assignees, client..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAddClientModal(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium text-sm"
        >
          <Building2 className="w-4 h-4" />
          Add Client
        </button>
        <button type="button" className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
          <Filter className="w-5 h-5" />
        </button>
      </div>

      <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Clients ({clients.length})</h2>
          <button
            type="button"
            onClick={() => setShowAddClientModal(true)}
            className="text-sm font-medium text-toptier-primary hover:text-toptier-primary-hover"
          >
            + Add Client
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="py-3 px-4 font-semibold text-gray-900">Name</th>
                <th className="py-3 px-4 font-semibold text-gray-900">Contact</th>
                <th className="py-3 px-4 font-semibold text-gray-900">Company</th>
                <th className="py-3 px-4 font-semibold text-gray-900">Contract</th>
                <th className="py-3 px-4 font-semibold text-gray-900">Objectives</th>
                <th className="py-3 px-4 font-semibold text-gray-900">Due date</th>
                <th className="py-3 px-4 font-semibold text-gray-900 w-20">Edit</th>
                {canRemoveClient && <th className="py-3 px-4 font-semibold text-gray-900 w-24">Remove</th>}
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={canRemoveClient ? 8 : 7} className="py-8 px-4 text-center text-gray-500 text-sm">
                    No clients yet. Click &quot;+ Add Client&quot; or the button above to add one.
                  </td>
                </tr>
              ) : (
                clients.map((c) => {
                  const target = c.objectives_target ?? 0;
                  const done = c.objectives_done ?? 0;
                  const pct = target > 0 ? Math.round((Math.min(done, target) / target) * 100) : 0;
                  return (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-medium text-gray-900">{c.name}</td>
                      <td className="py-3 px-4 text-gray-600">{c.contact || '—'}</td>
                      <td className="py-3 px-4 text-gray-600">{c.company || '—'}</td>
                      <td className="py-3 px-4">
                        {c.contract_url ? (
                          <a
                            href={c.contract_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-toptier-primary hover:underline"
                          >
                            <FileText className="w-4 h-4" />
                            View contract
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {target > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-700 whitespace-nowrap">
                              {c.objectives_done ?? 0} / {target} posts
                            </span>
                            <span className="text-xs font-medium text-gray-500">({pct}%)</span>
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-toptier-primary rounded-full"
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm">
                        {c.due_date ? format(parseISO(c.due_date), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => openEditClient(c)}
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-toptier-primary transition"
                          title="Edit contract, objectives, due date"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                      {canRemoveClient && (
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => removeClient(c.id)}
                            disabled={deletingClientId === c.id}
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                            title="Remove client (Executive only)"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingClientId && (() => {
        const client = clients.find((c) => c.id === editingClientId);
        if (!client) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={() => setEditingClientId(null)}>
            <div className="bg-white w-full sm:max-w-md max-h-[85dvh] sm:max-h-[90vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-xl shadow-modal border border-gray-200" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-900">Edit client — {client.name}</h2>
                <button type="button" onClick={() => setEditingClientId(null)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={saveEditClient} className="p-4 sm:p-5 space-y-4 overflow-auto min-h-0">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract (PDF or .docx)</label>
                  {client.contract_url ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={client.contract_url} target="_blank" rel="noopener noreferrer" className="text-sm text-toptier-primary hover:underline flex items-center gap-1">
                        <FileText className="w-4 h-4" /> View current
                      </a>
                      <button type="button" onClick={() => removeContract(client.id)} className="text-sm text-red-600 hover:underline">
                        Remove
                      </button>
                    </div>
                  ) : null}
                  <input
                    ref={contractInputRef}
                    type="file"
                    accept={CONTRACT_ACCEPT}
                    onChange={(e) => setContractFile(e.target.files?.[0] ?? null)}
                    className="mt-1 text-sm text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-toptier-primary/10 file:text-toptier-primary"
                  />
                  {contractFile && <span className="block mt-1 text-xs text-gray-500">{contractFile.name}</span>}
                </div>
                <div>
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                    <Target className="w-4 h-4" /> Objectives (posts to finish)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={editClientForm.objectives_done}
                      onChange={(e) => setEditClientForm((f) => ({ ...f, objectives_done: e.target.value }))}
                      placeholder="Done"
                      className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                    />
                    <span className="text-gray-500">/</span>
                    <input
                      type="number"
                      min={0}
                      value={editClientForm.objectives_target}
                      onChange={(e) => setEditClientForm((f) => ({ ...f, objectives_target: e.target.value }))}
                      placeholder="Target"
                      className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                    />
                    <span className="text-sm text-gray-500">posts</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
                  <input
                    type="date"
                    value={editClientForm.due_date}
                    onChange={(e) => setEditClientForm((f) => ({ ...f, due_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setEditingClientId(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100">
                    Cancel
                  </button>
                  <button type="submit" disabled={uploadingContract} className="px-4 py-2 rounded-lg bg-toptier-primary text-white font-medium hover:bg-toptier-primary-hover disabled:opacity-50">
                    {uploadingContract ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      <div className="mb-6 p-5 bg-white rounded-xl border border-gray-200 shadow-card">
        <h2 className="text-base font-semibold text-gray-900 mb-3">What happened yesterday — {yesterdaySummary.yesterdayStr}</h2>
        {yesterdaySummary.totalActions === 0 ? (
          <p className="text-gray-600 text-sm">No activity recorded for yesterday.</p>
        ) : (
          <div className="space-y-3 text-sm text-gray-700">
            {yesterdaySummary.created > 0 && (
              <p><strong>{yesterdaySummary.created}</strong> task{yesterdaySummary.created !== 1 ? 's were' : ' was'} created.</p>
            )}
            {(yesterdaySummary.toCompleted + yesterdaySummary.toInProgress + yesterdaySummary.toReview + yesterdaySummary.toTodo) > 0 && (
              <p>
                Status updates: {[
                  yesterdaySummary.toCompleted > 0 && `${yesterdaySummary.toCompleted} moved to Completed`,
                  yesterdaySummary.toInProgress > 0 && `${yesterdaySummary.toInProgress} to In Progress`,
                  yesterdaySummary.toReview > 0 && `${yesterdaySummary.toReview} to Review`,
                  yesterdaySummary.toTodo > 0 && `${yesterdaySummary.toTodo} to To Do`,
                ].filter(Boolean).join(', ')}.
              </p>
            )}
            {yesterdaySummary.comments > 0 && (
              <p><strong>{yesterdaySummary.comments}</strong> comment{yesterdaySummary.comments !== 1 ? 's were' : ' was'} added.</p>
            )}
            {yesterdaySummary.subtasksAdded > 0 && (
              <p><strong>{yesterdaySummary.subtasksAdded}</strong> subtask{yesterdaySummary.subtasksAdded !== 1 ? 's were' : ' was'} added.</p>
            )}
            {yesterdaySummary.people.length > 0 && (
              <p className="pt-2 border-t border-gray-100">
                People involved: <span className="font-medium text-gray-900">{yesterdaySummary.people.join(', ')}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">Loading tasks...</div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="space-y-6">
            {STATUS_ORDER.map((status) => {
              const list = tasksByStatus[status];
              return (
                <div key={status} className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/80">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${
                        status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : status === 'review'
                            ? 'bg-amber-100 text-amber-800'
                            : status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {IT_TASK_STATUS_LABELS[status]}
                    </span>
                    <span className="text-sm text-gray-500">{list.length}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCreateForm((f) => ({ ...f, status }));
                        setShowCreateModal(true);
                      }}
                      className="ml-auto p-1 rounded text-gray-400 hover:text-toptier-primary hover:bg-toptier-primary/10"
                      title="Add task"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {list.length === 0 ? (
                      <div className="px-4 py-6 text-center text-gray-500 text-sm">
                        <button
                          type="button"
                          onClick={() => {
                            setCreateForm((f) => ({ ...f, status }));
                            setShowCreateModal(true);
                          }}
                          className="text-toptier-primary hover:underline font-medium"
                        >
                          + Add Task
                        </button>
                      </div>
                    ) : (
                      list.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50/80 cursor-pointer transition"
                        >
                          <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{task.title}</p>
                            {task.assignees && task.assignees.length > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                {task.assignees.slice(0, 3).map((a) => (
                                  <Avatar key={a.id} name={a.full_name ?? ''} className="w-6 h-6 text-[10px]" />
                                ))}
                                {task.assignees.length > 3 && (
                                  <span className="text-xs text-gray-500">+{task.assignees.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0 text-sm text-gray-500">
                            {task.due_date ? (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {format(new Date(task.due_date), 'M/d/yy')}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                            {task.priority ? (
                              <span className="flex items-center gap-1">
                                <Flag className="w-4 h-4" />
                                {IT_TASK_PRIORITY_LABELS[task.priority]}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                            {task.client ? (
                              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 truncate max-w-[100px]" title={task.client.name}>
                                {task.client.name}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showAddClientModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={() => setShowAddClientModal(false)}>
          <div className="bg-white w-full sm:max-w-sm max-h-[85dvh] overflow-y-auto rounded-t-2xl sm:rounded-xl shadow-modal border border-gray-200 p-4 sm:p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Client</h3>
            <form onSubmit={addClient} className="space-y-3">
              <input
                type="text"
                value={newClient.name}
                onChange={(e) => setNewClient((c) => ({ ...c, name: e.target.value }))}
                placeholder="Client name *"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
                required
              />
              <input
                type="text"
                value={newClient.contact}
                onChange={(e) => setNewClient((c) => ({ ...c, contact: e.target.value }))}
                placeholder="Contact"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
              />
              <input
                type="text"
                value={newClient.company}
                onChange={(e) => setNewClient((c) => ({ ...c, company: e.target.value }))}
                placeholder="Company"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddClientModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-toptier-primary text-white font-medium hover:bg-toptier-primary-hover disabled:opacity-50">
                  Add Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateTaskModal
          form={createForm}
          setForm={setCreateForm}
          clients={clients}
          itMembers={itMembers}
          onClose={() => setShowCreateModal(false)}
          onSubmit={createTask}
          saving={saving}
        />
      )}

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          task={tasks.find((t) => t.id === selectedTaskId)}
          itMembers={itMembers}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={(updated) => setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))}
          onRemove={() => {
            setTasks((prev) => prev.filter((t) => t.id !== selectedTaskId));
            setSelectedTaskId(null);
          }}
        />
      )}
    </div>
  );
}

function CreateTaskModal({
  form,
  setForm,
  clients,
  itMembers,
  onClose,
  onSubmit,
  saving,
}: {
  form: { title: string; description: string; status: ITTaskStatus; priority: ITTaskPriority | ''; due_date: string; client_id: string; assignee_ids: string[] };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  clients: ITDepartmentClient[];
  itMembers: Profile[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
}) {
  const toggleAssignee = (id: string) => {
    setForm((f) => ({
      ...f,
      assignee_ids: f.assignee_ids.includes(id) ? f.assignee_ids.filter((x) => x !== id) : [...f.assignee_ids, id],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg max-h-[85dvh] sm:max-h-[90vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-xl shadow-modal border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Create Task</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0 overflow-auto">
          <div className="p-4 sm:p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task name</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Task name"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Add description"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary resize-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ITTaskStatus }))}
                className="px-3 py-2 rounded-lg border border-gray-200 text-gray-900 bg-white focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary text-sm"
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{IT_TASK_STATUS_LABELS[s]}</option>
                ))}
              </select>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  multiple
                  value={form.assignee_ids}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                    setForm((f) => ({ ...f, assignee_ids: selected }));
                  }}
                  className="pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-gray-900 bg-white focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary text-sm min-w-[140px]"
                >
                  {itMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-gray-200 text-gray-900 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary text-sm"
              />
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as ITTaskPriority | '' }))}
                className="px-3 py-2 rounded-lg border border-gray-200 text-gray-900 bg-white focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary text-sm"
              >
                <option value="">Priority</option>
                {PRIORITY_OPTIONS.filter(Boolean).map((p) => (
                  <option key={p} value={p}>{IT_TASK_PRIORITY_LABELS[p as ITTaskPriority]}</option>
                ))}
              </select>
              <select
                value={form.client_id}
                onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-gray-200 text-gray-900 bg-white focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary text-sm"
              >
                <option value="">No client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {itMembers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assignees</label>
                <div className="flex flex-wrap gap-2">
                  {itMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleAssignee(m.id)}
                      className={`flex items-center gap-2 px-2 py-1 rounded-full text-sm border transition ${
                        form.assignee_ids.includes(m.id)
                          ? 'border-toptier-primary bg-toptier-primary/10 text-toptier-primary'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Avatar name={m.full_name ?? ''} className="w-5 h-5 text-[10px]" />
                      {m.full_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 bg-gray-50">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!form.title.trim() || saving}
              className="px-4 py-2 rounded-lg bg-toptier-primary text-white font-medium hover:bg-toptier-primary-hover disabled:opacity-50"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskDetailPanel({
  taskId,
  task,
  itMembers,
  onClose,
  onUpdate,
  onRemove,
}: {
  taskId: string;
  task: ITDepartmentTaskWithDetails | undefined;
  itMembers: Profile[];
  onClose: () => void;
  onUpdate: (t: ITDepartmentTaskWithDetails) => void;
  onRemove: () => void;
}) {
  const { user, profile } = useAuth();
  const [subtasks, setSubtasks] = useState<ITDepartmentSubtask[]>([]);
  const [activity, setActivity] = useState<ITDepartmentActivity[]>([]);
  const [comments, setComments] = useState<(ITDepartmentComment & { profiles: Pick<Profile, 'full_name'> | null })[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ITTaskStatus>(task?.status ?? 'todo');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    setStatus(task?.status ?? 'todo');
    let cancelled = false;
    (async () => {
      const [subRes, actRes, comRes] = await Promise.all([
        supabase.from('it_department_subtasks').select('*').eq('task_id', taskId).order('sort_order'),
        supabase.from('it_department_activity').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
        supabase.from('it_department_comments').select('*, profiles!user_id(full_name)').eq('task_id', taskId).order('created_at'),
      ]);
      if (cancelled) return;
      setSubtasks((subRes.data ?? []) as ITDepartmentSubtask[]);
      setActivity((actRes.data ?? []) as ITDepartmentActivity[]);
      setComments((comRes.data ?? []) as (ITDepartmentComment & { profiles: Pick<Profile, 'full_name'> | null })[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [taskId, task?.status]);

  const updateStatus = async (newStatus: ITTaskStatus) => {
    setStatus(newStatus);
    await supabase.from('it_department_tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', taskId);
    if (task && user?.id)
      await supabase.from('it_department_activity').insert({
        task_id: taskId,
        user_id: user.id,
        action_type: 'status_change',
        details: `Changed status to ${IT_TASK_STATUS_LABELS[newStatus]}`,
      });
    onUpdate({ ...task!, status: newStatus });
  };

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('it_department_subtasks')
        .insert({
          task_id: taskId,
          title: newSubtaskTitle.trim(),
          status: 'open',
          sort_order: subtasks.length,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (error) throw error;
      setSubtasks((prev) => [...prev, data as ITDepartmentSubtask]);
      setNewSubtaskTitle('');
      if (user?.id) {
        const { data: act } = await supabase
          .from('it_department_activity')
          .insert({
            task_id: taskId,
            user_id: user.id,
            action_type: 'subtask_added',
            details: `Added subtask: ${newSubtaskTitle.trim()}`,
          })
          .select('*')
          .single();
        if (act) setActivity((prev) => [act as ITDepartmentActivity, ...prev]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleSubtask = async (sub: ITDepartmentSubtask) => {
    const newStatus = sub.status === 'open' ? 'completed' : 'open';
    await supabase
      .from('it_department_subtasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', sub.id);
    setSubtasks((prev) => prev.map((s) => (s.id === sub.id ? { ...s, status: newStatus } : s)));
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user?.id || saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('it_department_comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          body: newComment.trim(),
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (error) throw error;
      const row = data as ITDepartmentComment & { profiles: Pick<Profile, 'full_name'> | null };
      row.profiles = { full_name: profile?.full_name ?? 'You' };
      setComments((prev) => [row, ...prev]);
      setNewComment('');
      const { data: act } = await supabase
        .from('it_department_activity')
        .insert({
          task_id: taskId,
          user_id: user.id,
          action_type: 'comment',
          details: 'Added a comment',
        })
        .select('*')
        .single();
      if (act) setActivity((prev) => [act as ITDepartmentActivity, ...prev]);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async () => {
    if (!confirm('Delete this task? Subtasks, comments, and activity will be removed.')) return;
    await supabase.from('it_department_tasks').delete().eq('id', taskId);
    onRemove();
  };

  if (!task) {
    return (
      <div className="fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:max-w-xl bg-white shadow-modal border-l border-gray-200 z-40 flex flex-col">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg text-gray-500 hover:bg-gray-100 z-10">
          <X className="w-5 h-5" />
        </button>
        <p className="text-gray-500">Task not found.</p>
      </div>
    );
  }

  const openSubtasks = subtasks.filter((s) => s.status === 'open').length;

  return (
    <div className="fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:max-w-xl bg-white shadow-modal border-l border-gray-200 z-40 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 truncate pr-8">{task.title}</h2>
        <div className="flex items-center gap-1 absolute top-4 right-4">
          <button
            type="button"
            onClick={deleteTask}
            className="p-2 rounded-lg text-red-600 hover:bg-red-50"
            title="Delete task"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-6">
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={status}
            onChange={(e) => updateStatus(e.target.value as ITTaskStatus)}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-900 bg-white text-sm font-medium focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{IT_TASK_STATUS_LABELS[s]}</option>
            ))}
          </select>
          {task.due_date && (
            <span className="flex items-center gap-1 text-sm text-gray-600">
              <Calendar className="w-4 h-4" />
              Due {format(new Date(task.due_date), 'MMM d, yyyy')}
            </span>
          )}
          {task.assignees && task.assignees.length > 0 && (
            <div className="flex items-center gap-1">
              {task.assignees.map((a) => (
                <Avatar key={a.id} name={a.full_name ?? ''} className="w-7 h-7 text-xs" />
              ))}
            </div>
          )}
          {task.priority && (
            <span className="px-2 py-0.5 rounded text-sm bg-gray-100 text-gray-700">
              {IT_TASK_PRIORITY_LABELS[task.priority]}
            </span>
          )}
          {task.client && (
            <span className="px-2 py-0.5 rounded text-sm bg-toptier-primary/10 text-toptier-primary">
              {task.client.name}
            </span>
          )}
        </div>

        {task.description && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-1">Description</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <ListTodo className="w-4 h-4" />
            Subtasks {openSubtasks > 0 && `${openSubtasks} open`}
          </h3>
          <ul className="space-y-2">
            {subtasks.map((sub) => (
              <li key={sub.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSubtask(sub)}
                  className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                    sub.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-toptier-primary'
                  }`}
                >
                  {sub.status === 'completed' && <span className="text-white text-xs">✓</span>}
                </button>
                <span className={sub.status === 'completed' ? 'text-gray-500 line-through text-sm' : 'text-sm text-gray-900'}>{sub.title}</span>
              </li>
            ))}
          </ul>
          <form onSubmit={addSubtask} className="mt-2 flex gap-2">
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              placeholder="Add subtask..."
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm placeholder-gray-500 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary"
            />
            <button type="submit" disabled={!newSubtaskTitle.trim() || saving} className="px-3 py-2 rounded-lg bg-toptier-primary text-white text-sm font-medium hover:bg-toptier-primary-hover disabled:opacity-50">
              Add
            </button>
          </form>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Activity
          </h3>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-gray-500">No activity yet.</p>
          ) : (
            <ul className="space-y-2 text-sm text-gray-600">
              {activity.map((a) => (
                <li key={a.id}>
                  {a.details} — {format(new Date(a.created_at), 'MMM d, yyyy h:mm a')}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Comments</h3>
          <form onSubmit={addComment} className="mb-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm placeholder-gray-500 focus:ring-2 focus:ring-toptier-primary focus:border-toptier-primary resize-none"
            />
            <button type="submit" disabled={!newComment.trim() || saving} className="mt-2 px-3 py-1.5 rounded-lg bg-toptier-primary text-white text-sm font-medium hover:bg-toptier-primary-hover disabled:opacity-50">
              Comment
            </button>
          </form>
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="text-sm">
                <span className="font-medium text-gray-900">{c.profiles?.full_name ?? 'Someone'}</span>
                <span className="text-gray-500 ml-2">{format(new Date(c.created_at), 'MMM d, h:mm a')}</span>
                <p className="mt-0.5 text-gray-700">{c.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
