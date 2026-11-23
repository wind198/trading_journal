-- Pin flag for dashboard notes (pinned notes sort first in the sidebar).
ALTER TABLE dashboard_notes
  ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT FALSE;
