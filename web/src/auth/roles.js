export const DEFAULT_ROLE_KEYS = {
  ADMIN: 'ADMIN',
  EXECUTIVE: 'EXECUTIVE',
  BUSINESS_OWNER: 'BUSINESS_OWNER',
};

export const PERMISSION_OPTIONS = [
  {
    key: 'view_portfolio_dashboard_all',
    label: 'View Portfolio Dashboard - All',
    description: 'Access the portfolio dashboard with all portfolio items.',
  },
  {
    key: 'view_portfolio_dashboard_owned',
    label: 'View Portfolio Dashboard - Owned',
    description: 'Access the portfolio dashboard limited to owned items.',
  },
  {
    key: 'view_all_initiatives',
    label: 'View All Initiatives',
    description: 'View all annual operational initiatives.',
  },
  {
    key: 'view_owned_initiatives',
    label: 'View Owned Initiatives',
    description: 'View only initiatives the user owns or sponsors.',
  },
  {
    key: 'edit_all_initiatives',
    label: 'Edit All Initiatives',
    description: 'Edit all annual operational initiatives.',
  },
  {
    key: 'edit_owned_initiatives',
    label: 'Edit Owned Initiatives',
    description: 'Edit only initiatives the user owns or sponsors.',
  },
  {
    key: 'view_all_projects',
    label: 'View All Projects',
    description: 'View all projects across the portfolio.',
  },
  {
    key: 'view_owned_projects',
    label: 'View Owned Projects',
    description: 'View only projects the user owns or sponsors.',
  },
  {
    key: 'edit_all_projects',
    label: 'Edit All Projects',
    description: 'Edit all projects across the portfolio.',
  },
  {
    key: 'edit_owned_projects',
    label: 'Edit Owned Projects',
    description: 'Edit only projects the user owns or sponsors.',
  },
  {
    key: 'submit_status_updates',
    label: 'Submit Status Updates',
    description: 'Add project and initiative status updates.',
  },
  {
    key: 'manage_users',
    label: 'Manage Users And Roles',
    description: 'Manage users, roles, and access definitions.',
  },
  {
    key: 'configure_reference_data',
    label: 'Configure Reference Data',
    description: 'Maintain reference data and configuration lists.',
  },
  {
    key: 'archive_records',
    label: 'Archive Records',
    description: 'Archive projects, initiatives, or related records.',
  },
  {
    key: 'approve_portfolio_decisions',
    label: 'Approve Portfolio Decisions',
    description: 'Approve key intake and portfolio decisions.',
  },
  {
    key: 'view_strategies',
    label: 'View Strategies',
    description: 'View strategic priorities and priority periods.',
  },
  {
    key: 'add_strategies',
    label: 'Add Strategies',
    description: 'Create strategic priority periods and strategy definitions.',
  },
  {
    key: 'submit_projects',
    label: 'Submit Projects',
    description: 'Create new project proposals for review.',
  },
  {
    key: 'review_proposals',
    label: 'Review Proposals',
    description: 'Review submitted projects and move them through intake decisions.',
  },
  {
    key: 'add_initiatives',
    label: 'Add Initiatives',
    description: 'Create new annual operational initiatives.',
  },
  {
    key: 'manage_risks',
    label: 'Manage Risks',
    description: 'Create and update risks, mitigations, and assessments.',
  },
];

const LEGACY_PERMISSION_EXPANSIONS = {
  manage_strategy: [
    'view_all_initiatives',
    'view_owned_initiatives',
    'edit_all_initiatives',
    'view_strategies',
    'add_strategies',
    'add_initiatives',
  ],
  manage_portfolio: [
    'view_portfolio_dashboard_all',
    'view_all_initiatives',
    'view_owned_initiatives',
    'edit_all_initiatives',
    'edit_owned_initiatives',
    'view_all_projects',
    'view_owned_projects',
    'edit_all_projects',
    'edit_owned_projects',
    'submit_status_updates',
  ],
  manage_users: ['manage_users'],
  review_proposals: ['review_proposals'],
  submit_projects: ['submit_projects'],
  manage_risks: ['manage_risks'],
};

export const PERMISSION_KEYS = PERMISSION_OPTIONS.map((option) => option.key);

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
}

function getEmailAliases(email) {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (!normalizedEmail.includes('@')) {
    return [];
  }

  const localPart = normalizedEmail.split('@')[0];
  return [localPart.replace(/[._-]+/g, ' '), localPart];
}

function getUserIdentityLabels(user) {
  return Array.from(
    new Set(
      [
        user?.name,
        user?.email,
        ...getEmailAliases(user?.email),
      ]
        .map(normalizeText)
        .filter(Boolean),
    ),
  );
}

function matchesOwnerLabel(user, ownerValue) {
  const normalizedOwner = normalizeText(ownerValue);
  if (!normalizedOwner) {
    return false;
  }

  return getUserIdentityLabels(user).includes(normalizedOwner);
}

export function normalizePermissions(permissions) {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return Array.from(
    new Set(
      permissions.flatMap((permission) => {
        const normalizedPermission = String(permission ?? '').trim();
        if (PERMISSION_KEYS.includes(normalizedPermission)) {
          return [normalizedPermission];
        }

        return LEGACY_PERMISSION_EXPANSIONS[normalizedPermission] ?? [];
      }),
    ),
  );
}

export function hasPermission(permissions, requiredPermission) {
  return normalizePermissions(permissions).includes(requiredPermission);
}

export function hasAllPermissions(permissions, requiredPermissions = []) {
  const normalizedPermissions = normalizePermissions(permissions);
  return requiredPermissions.every((permission) => normalizedPermissions.includes(permission));
}

export function hasAnyPermission(permissions, requiredPermissions = []) {
  const normalizedPermissions = normalizePermissions(permissions);
  return requiredPermissions.some((permission) => normalizedPermissions.includes(permission));
}

export function canViewPortfolioDashboard(permissions) {
  return hasAnyPermission(permissions, [
    'view_portfolio_dashboard_all',
    'view_portfolio_dashboard_owned',
  ]);
}

export function canViewAllPortfolioDashboard(permissions) {
  return hasPermission(permissions, 'view_portfolio_dashboard_all');
}

export function canViewOwnedPortfolioDashboard(permissions) {
  return hasPermission(permissions, 'view_portfolio_dashboard_owned');
}

export function canViewStrategies(permissions) {
  return hasPermission(permissions, 'view_strategies');
}

export function canAddStrategies(permissions) {
  return hasPermission(permissions, 'add_strategies');
}

export function canManageStrategy(permissions) {
  return canAddStrategies(permissions) || hasPermission(permissions, 'add_initiatives');
}

export function canManageUsers(permissions) {
  return hasPermission(permissions, 'manage_users');
}

export function canReviewProposals(permissions) {
  return hasPermission(permissions, 'review_proposals');
}

export function canApprovePortfolioDecisions(permissions) {
  return hasPermission(permissions, 'approve_portfolio_decisions');
}

export function canSubmitProjects(permissions) {
  return hasPermission(permissions, 'submit_projects');
}

export function canAddInitiatives(permissions) {
  return hasPermission(permissions, 'add_initiatives');
}

export function canSubmitStatusUpdates(permissions) {
  return hasPermission(permissions, 'submit_status_updates');
}

export function canManageRisks(permissions) {
  return hasPermission(permissions, 'manage_risks');
}

export function canViewProjects(permissions) {
  return hasAnyPermission(permissions, ['view_all_projects', 'view_owned_projects']);
}

export function canViewInitiatives(permissions) {
  return hasAnyPermission(permissions, ['view_all_initiatives', 'view_owned_initiatives']);
}

export function canEditAnyProject(permissions) {
  return hasAnyPermission(permissions, ['edit_all_projects', 'edit_owned_projects']);
}

export function canEditAnyInitiative(permissions) {
  return hasAnyPermission(permissions, ['edit_all_initiatives', 'edit_owned_initiatives']);
}

export function canManagePortfolio(permissions) {
  return canEditAnyProject(permissions)
    || canEditAnyInitiative(permissions)
    || canSubmitStatusUpdates(permissions);
}

export function isOwnedProject(user, project) {
  return matchesOwnerLabel(user, project?.businessOwner) || matchesOwnerLabel(user, project?.executiveSponsor);
}

export function isOwnedInitiative(user, initiative, relatedProjects = []) {
  if (matchesOwnerLabel(user, initiative?.owner)) {
    return true;
  }

  return relatedProjects.some((project) => isOwnedProject(user, project));
}

export function canViewProject(permissions, user, project) {
  if (hasPermission(permissions, 'view_all_projects')) {
    return true;
  }

  return hasPermission(permissions, 'view_owned_projects') && isOwnedProject(user, project);
}

export function canEditProject(permissions, user, project) {
  if (hasPermission(permissions, 'edit_all_projects')) {
    return true;
  }

  return hasPermission(permissions, 'edit_owned_projects') && isOwnedProject(user, project);
}

export function canViewInitiative(permissions, user, initiative, relatedProjects = []) {
  if (hasPermission(permissions, 'view_all_initiatives')) {
    return true;
  }

  return hasPermission(permissions, 'view_owned_initiatives') && isOwnedInitiative(user, initiative, relatedProjects);
}

export function canEditInitiative(permissions, user, initiative, relatedProjects = []) {
  if (hasPermission(permissions, 'edit_all_initiatives')) {
    return true;
  }

  return hasPermission(permissions, 'edit_owned_initiatives') && isOwnedInitiative(user, initiative, relatedProjects);
}
