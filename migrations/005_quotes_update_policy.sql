-- Allow quote edits for DBs that already ran 003 without UPDATE policy.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quotes'
      AND policyname = 'Users can update their own quotes'
  ) THEN
    CREATE POLICY "Users can update their own quotes"
      ON quotes FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
