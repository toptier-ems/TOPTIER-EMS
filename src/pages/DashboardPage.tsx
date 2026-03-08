import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Users, Calendar, FileText, MessageCircle, Settings, UserCheck, CalendarDays, Video, UsersRound, Briefcase, ClipboardList } from 'lucide-react';
import type { AppRole } from '../types/database';

type DashboardCard = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  roles: AppRole[];
};

const ALL_ROLES: AppRole[] = ['ceo', 'executive', 'hr', 'manager', 'supervisor', 'tl', 'trainer', 'employee'];

const DASHBOARD_CARDS: DashboardCard[] = [
  { to: '/profile', label: 'My Profile', icon: Users, desc: 'View your profile & accomplishments', roles: ALL_ROLES },
  { to: '/feed', label: 'Feed', icon: MessageCircle, desc: 'Posts, My Day, comment & like', roles: ALL_ROLES },
  { to: '/leave', label: 'Leave', icon: Calendar, desc: 'Request emergency, vacation, or sick leave', roles: ALL_ROLES },
  { to: '/settings', label: 'Settings', icon: Settings, desc: 'Edit your info, avatar, bio', roles: ALL_ROLES },
  { to: '/employees', label: 'Total Employees', icon: UsersRound, desc: 'View all employees and their details', roles: ['ceo', 'executive', 'hr'] },
  { to: '/recruitment', label: 'Recruitment', icon: Briefcase, desc: 'Applicants and hiring pipeline', roles: ['ceo', 'executive', 'manager', 'trainer', 'supervisor', 'hr'] },
  { to: '/leave/requests', label: 'Leave Requests', icon: FileText, desc: 'Review and approve leave requests', roles: ['ceo', 'executive', 'hr', 'manager', 'supervisor', 'tl'] },
  { to: '/leave/allocation', label: 'Leave Allocation', icon: CalendarDays, desc: 'Set vacation, sick, emergency days per year', roles: ['ceo', 'hr'] },
  { to: '/meetings', label: 'Meetings', icon: Video, desc: 'Create and view meetings', roles: ['ceo', 'executive', 'hr', 'manager', 'supervisor', 'tl'] },
  { to: '/employee-approval', label: 'Employee Approval', icon: UserCheck, desc: 'Approve or reject new user accounts', roles: ['ceo', 'hr', 'supervisor'] },
  { to: '/action-log', label: 'Action Log', icon: ClipboardList, desc: 'Recruitment, Leave Request & Allocation activity', roles: ['ceo', 'executive'] },
];

export default function DashboardPage() {
  const { profile } = useAuth();
  const position = profile?.position;
  const cards = DASHBOARD_CARDS.filter((c) => position && c.roles.includes(position));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">
        Welcome, {profile?.full_name ?? 'User'}
      </h1>
      <p className="text-gray-500 mb-8">Your hub · Choose a page to get started</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ to, label, icon: Icon, desc }) => (
          <Link
            key={to}
            to={to}
            className="flex items-start gap-4 p-5 rounded-xl bg-white border border-gray-200 hover:border-toptier-primary/40 hover:shadow-md transition group"
          >
            <div className="p-2.5 rounded-lg bg-toptier-primary/10 text-toptier-primary group-hover:bg-gradient-to-br group-hover:from-toptier-primary/20 group-hover:via-toptier-pumpkin/20 group-hover:to-toptier-amber/20 transition">
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 group-hover:text-toptier-primary transition">{label}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
