import { useAuth } from '../contexts/AuthContext';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PendingApprovalPage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-toptier-primary px-4">
      <div className="max-w-md w-full bg-white rounded-card border border-gray-200 shadow-card p-8 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Account Pending Approval</h1>
        <p className="text-toptier-muted mb-6">
          Your account is waiting to be approved by HR, Manager, or CEO. You will be able to access the app once approved.
        </p>
        <p className="text-sm text-toptier-muted mb-6">
          Registered as <span className="font-medium text-gray-900">{profile?.full_name}</span> · {profile?.email}
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
