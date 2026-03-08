export type AppRole = 'ceo' | 'executive' | 'hr' | 'manager' | 'supervisor' | 'tl' | 'trainer' | 'employee';

export type LeaveType = 'emergency' | 'vacation' | 'sick';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  position: AppRole;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
  contact_number?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_number?: string | null;
  blood_type?: string | null;
  approval_status?: 'pending' | 'approved' | 'rejected';
  approved_at?: string | null;
  approved_by?: string | null;
  feed_points?: number;
  address?: string | null;
  deleted_at?: string | null;
  presence_status?: PresenceStatus | null;
  employee_badge?: EmployeeBadge | null;
}

export type PresenceStatus = 'present' | 'absent' | 'on_leave' | 'rest_day';

export const PRESENCE_STATUS_LABELS: Record<PresenceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  on_leave: 'On Leave',
  rest_day: 'Rest Day',
};

export type EmployeeBadge = 'best_employee' | 'best_teacher' | 'rising_star' | 'no_absences' | 'no_lates' | 'most_improved';

export const EMPLOYEE_BADGE_LABELS: Record<EmployeeBadge, string> = {
  best_employee: '🏆 Best Employee',
  best_teacher: '🍎 Best Teacher',
  rising_star: '⭐ Rising Star',
  no_absences: '⏰ No Absences',
  no_lates: '⏱ No Lates',
  most_improved: '📈 Most Improved',
};

export interface ProfileRestDay {
  id: string;
  user_id: string;
  rest_date: string;
  created_at: string;
}

export interface ProfilePlannedLeave {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface ActionLog {
  id: string;
  user_id: string;
  action_type: string;
  details: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface Skill {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Interest {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  reference_id: string | null;
  from_user_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Meeting {
  id: string;
  user_id: string;
  title: string;
  start_at: string;
  end_at: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveAllocation {
  id: string;
  user_id: string;
  year: number;
  vacation_days: number;
  sick_days: number;
  emergency_days: number;
  created_at: string;
  updated_at: string;
}

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export interface Accomplishment {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  achieved_at: string | null;
  created_at: string;
  company?: string | null;
  employment_type?: string | null;
  location?: string | null;
  is_current_role?: boolean;
  start_date?: string | null;
  end_date?: string | null;
}

export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance', 'Self-employed', 'Volunteer'] as const;
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveStatus;
  accepted_by: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedPost {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  created_at: string;
  updated_at: string;
}

export interface FeedLike {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface FeedComment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileWithUser extends Profile {
  accomplishments?: Accomplishment[];
}

export interface FeedPostWithAuthor extends FeedPost {
  profiles: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'position' | 'feed_points' | 'employee_badge'> | null;
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
}

export interface FeedCommentWithAuthor extends FeedComment {
  profiles: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'position' | 'employee_badge'> | null;
}

export interface FeedShort {
  id: string;
  user_id: string;
  media_url: string;
  created_at: string;
}

export interface FeedShortWithAuthor extends FeedShort {
  profiles: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null;
}

export type ShortReactionType = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

export interface FeedShortReaction {
  id: string;
  short_id: string;
  user_id: string;
  reaction_type: ShortReactionType;
  created_at: string;
}

export const POSITION_LABELS: Record<AppRole, string> = {
  ceo: 'CEO',
  executive: 'Executive',
  hr: 'HR',
  manager: 'Manager',
  supervisor: 'Supervisor',
  tl: 'Team Lead',
  trainer: 'Trainer',
  employee: 'Employee',
};

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  emergency: 'Emergency Leave',
  vacation: 'Vacation Leave',
  sick: 'Sick Leave',
};

export type ApplicantStatus = 'initial_interview' | 'training' | 'final_interview';

export interface Applicant {
  id: string;
  name: string;
  position_applied_for: string;
  age: number | null;
  experience: string | null;
  educational_attainment: string | null;
  resume_url: string | null;
  status: ApplicantStatus;
  created_at: string;
  updated_at: string;
}

export const APPLICANT_STATUS_LABELS: Record<ApplicantStatus, string> = {
  initial_interview: 'Initial Interview',
  training: 'Training',
  final_interview: 'Final Interview',
};
