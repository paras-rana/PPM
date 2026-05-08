export const DEFAULT_ROLE_KEYS = ['ADMIN', 'EXECUTIVE', 'BUSINESS_OWNER'] as const;

export const PERMISSION_KEYS = [
  'view_portfolio_dashboard_all',
  'view_portfolio_dashboard_owned',
  'view_all_initiatives',
  'view_owned_initiatives',
  'edit_all_initiatives',
  'edit_owned_initiatives',
  'view_all_projects',
  'view_owned_projects',
  'edit_all_projects',
  'edit_owned_projects',
  'submit_status_updates',
  'manage_users',
  'configure_reference_data',
  'archive_records',
  'approve_portfolio_decisions',
  'view_strategies',
  'add_strategies',
  'submit_projects',
  'review_proposals',
  'add_initiatives',
  'manage_risks',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type AuthRole = string;

export type AuthUser = {
  userId: string;
  email: string;
  role: AuthRole;
  permissions: PermissionKey[];
  name: string | null;
};

export type LoginResult = {
  token: string;
  user: AuthUser;
  expiresAt: string;
};
