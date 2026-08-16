-- Deleting a user (via auth.users, which cascades to profiles) currently
-- fails if they ever created or accepted an invite: invites.created_by and
-- invites.accepted_by reference profiles with no ON DELETE rule, which
-- defaults to NO ACTION -- the delete gets rejected by the FK constraint.
-- created_by is NOT NULL, so an invite from a deleted user should just go
-- away with them; accepted_by is nullable, so it can simply be cleared.
alter table invites drop constraint invites_created_by_fkey;
alter table invites add constraint invites_created_by_fkey
  foreign key (created_by) references profiles(id) on delete cascade;

alter table invites drop constraint invites_accepted_by_fkey;
alter table invites add constraint invites_accepted_by_fkey
  foreign key (accepted_by) references profiles(id) on delete set null;
