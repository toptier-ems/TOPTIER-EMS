import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { AppRole } from '../types/database';
import SearchBar from './SearchBar';
import TimeClock from './TimeClock';
import PresenceToggle from './PresenceToggle';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  MessageCircle,
  UserCheck,
  PieChart,
  CalendarDays,
  UsersRound,
  Briefcase,
  ClipboardList,
} from 'lucide-react';

const LOGO_SRC = '/logo.png';

const NAV_ALL = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/feed', label: 'Feed', icon: MessageCircle },
  { to: '/profile', label: 'My Profile', icon: Users },
  { to: '/leave', label: 'Leave', icon: Calendar },
  { to: '/meetings', label: 'My Meetings', icon: CalendarDays },
  { to: '/employees', label: 'Total Employees', icon: UsersRound, roles: ['ceo', 'executive', 'hr'] as AppRole[] },
  { to: '/recruitment', label: 'Recruitment', icon: Briefcase, roles: ['ceo', 'executive', 'manager', 'trainer', 'supervisor', 'hr'] as AppRole[] },
  { to: '/leave/requests', label: 'Leave Requests', icon: FileText, roles: ['ceo', 'executive', 'hr', 'manager', 'supervisor', 'tl', 'trainer'] as AppRole[] },
  { to: '/employee-approval', label: 'Employee Approval', icon: UserCheck, roles: ['ceo', 'hr', 'supervisor'] as AppRole[] },
  { to: '/leave/allocation', label: 'Leave Allocation', icon: PieChart, roles: ['ceo', 'hr'] as AppRole[] },
  { to: '/action-log', label: 'Action Log', icon: ClipboardList, roles: ['ceo', 'executive'] as AppRole[] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const location = useLocation();

  const nav = NAV_ALL.filter((item) => !item.roles || (profile && item.roles.includes(profile.position)));

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <Link
          to="/dashboard"
          className="flex items-center justify-center px-4 py-4 border-b border-gray-100"
          aria-label="Dashboard"
        >
          <img
            src={LOGO_SRC}
            alt=""
            className="h-10 w-auto max-w-[180px] object-contain object-left"
          />
        </Link>
        <nav className="flex-1 py-3 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => {
            const isActive =
              location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-toptier-primary/10 text-toptier-primary'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex-shrink-0 flex items-center justify-between gap-4 px-6 border-b border-gray-200 bg-white">
          <div className="flex-1 min-w-0 flex items-center gap-4">
            <SearchBar />
          </div>
          <div className="flex items-center gap-2">
            <PresenceToggle />
            <TimeClock />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
