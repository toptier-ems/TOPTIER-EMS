-- When an employee is soft-deleted (deleted_at set on profiles), automatically delete all their related data:
-- feed, leaves, accomplishments, skills, interests, notifications, action_logs, meetings, pd_responses, IT task data, etc.

CREATE OR REPLACE FUNCTION public.cascade_delete_employee_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID;
BEGIN
  -- Only run when deleted_at is set (transition from NULL to NOT NULL)
  IF NEW.deleted_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.deleted_at IS NOT NULL THEN
    RETURN NEW; -- already was deleted
  END IF;

  uid := NEW.id;

  -- pd_certificates reference accomplishments; delete first
  DELETE FROM public.pd_certificates
  WHERE accomplishment_id IN (SELECT id FROM public.accomplishments WHERE user_id = uid);

  DELETE FROM public.accomplishments WHERE user_id = uid;

  -- Feed: short reactions on user's shorts, then shorts, then likes/comments by user, then posts (cascades likes/comments on those posts)
  DELETE FROM public.feed_short_reactions
  WHERE short_id IN (SELECT id FROM public.feed_shorts WHERE user_id = uid);
  DELETE FROM public.feed_shorts WHERE user_id = uid;
  DELETE FROM public.feed_likes WHERE user_id = uid;
  DELETE FROM public.feed_comments WHERE user_id = uid;
  DELETE FROM public.feed_posts WHERE user_id = uid;

  DELETE FROM public.leave_requests WHERE user_id = uid;
  DELETE FROM public.leave_allocations WHERE user_id = uid;
  DELETE FROM public.profile_rest_days WHERE user_id = uid;
  DELETE FROM public.profile_planned_leave WHERE user_id = uid;
  DELETE FROM public.skills WHERE user_id = uid;
  DELETE FROM public.interests WHERE user_id = uid;
  DELETE FROM public.notifications WHERE user_id = uid OR from_user_id = uid;
  DELETE FROM public.action_logs WHERE user_id = uid;
  DELETE FROM public.meetings WHERE user_id = uid;
  DELETE FROM public.pd_responses WHERE user_id = uid;

  -- IT department: remove from assignees and activity/comments; null subtask assignee; delete tasks they created
  DELETE FROM public.it_department_task_assignees WHERE user_id = uid;
  DELETE FROM public.it_department_activity WHERE user_id = uid;
  DELETE FROM public.it_department_comments WHERE user_id = uid;
  UPDATE public.it_department_subtasks SET assignee_id = NULL WHERE assignee_id = uid;
  DELETE FROM public.it_department_tasks WHERE created_by = uid;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_soft_delete_cascade ON public.profiles;
CREATE TRIGGER on_profile_soft_delete_cascade
  AFTER UPDATE OF deleted_at ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_delete_employee_data();

COMMENT ON FUNCTION public.cascade_delete_employee_data() IS 'Deletes all data belonging to a profile when that profile is soft-deleted (deleted_at set).';
