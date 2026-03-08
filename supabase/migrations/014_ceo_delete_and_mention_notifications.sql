-- CEO can delete any post on the feed (not only own)
CREATE POLICY "Feed posts delete as CEO"
  ON public.feed_posts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.position = 'ceo'
    )
  );

-- Allow inserting notifications for others when you are the actor (for @mentions)
-- "Notifications own" only allows rows where user_id = auth.uid(), so inserts for
-- mentioned users were blocked. Allow INSERT when from_user_id = auth.uid().
CREATE POLICY "Notifications insert from actor"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (from_user_id = auth.uid());
