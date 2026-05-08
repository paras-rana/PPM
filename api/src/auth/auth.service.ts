import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_ROLE_KEYS,
  PERMISSION_KEYS,
  type AuthRole,
  type AuthUser,
  type LoginResult,
  type PermissionKey,
} from './auth.types';

type UserRow = {
  user_id: string;
  email: string;
  password_hash: string;
  role: string;
  full_name: string | null;
  is_active: boolean;
};

type RoleRow = {
  role_key: string;
  display_name: string;
  permissions: unknown;
  is_system: boolean;
};

const LEGACY_PERMISSION_EXPANSIONS: Record<string, PermissionKey[]> = {
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

type TokenPayload = AuthUser & {
  exp: number;
};

export type UserSummary = {
  userId: string;
  email: string;
  role: AuthRole;
  permissions: PermissionKey[];
  name: string | null;
  isActive: boolean;
};

export type CreateUserInput = {
  email: string;
  password: string;
  role: AuthRole;
  name?: string | null;
};

export type UpdateUserInput = {
  email?: string;
  password?: string;
  role?: AuthRole;
  name?: string | null;
};

export type RoleSummary = {
  roleKey: string;
  displayName: string;
  permissions: PermissionKey[];
  isSystem: boolean;
};

export type CreateRoleInput = {
  roleKey: string;
  displayName: string;
  permissions: PermissionKey[];
};

export type UpdateRoleInput = {
  displayName?: string;
  permissions?: PermissionKey[];
};

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly tokenSecret =
    process.env.AUTH_TOKEN_SECRET ?? 'riskapp-local-auth-secret-change-me';
  private readonly tokenTtlSeconds = Number(
    process.env.AUTH_TOKEN_TTL_SECONDS ?? 60 * 60 * 12,
  );

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureRolesTable();
    await this.ensureUsersTable();
    await this.ensureDefaultRoles();
    await this.ensureDefaultUsers();
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const rows = await this.prisma.$queryRaw<UserRow[]>`
      SELECT
        user_id,
        email,
        password_hash,
        role,
        full_name,
        is_active
      FROM app_users
      WHERE email = ${normalizedEmail}
      LIMIT 1
    `;

    const user = rows[0];
    if (
      !user ||
      !user.is_active ||
      !this.verifyPassword(password, user.password_hash)
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const authUser = await this.buildAuthUser(user);

    return this.createLoginResult(authUser);
  }

  async verifyToken(token: string): Promise<LoginResult['user']> {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) {
      throw new UnauthorizedException('Invalid token');
    }

    const expectedSignature = this.sign(encodedPayload);
    if (signature.length !== expectedSignature.length) {
      throw new UnauthorizedException('Invalid token signature');
    }

    if (
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      throw new UnauthorizedException('Invalid token signature');
    }

    let payload: TokenPayload;
    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as TokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Token expired');
    }

    const normalizedRole = this.normalizeRole(payload.role);

    return {
      userId: payload.userId,
      email: payload.email,
      role: normalizedRole,
      permissions: await this.getPermissionsForRole(normalizedRole),
      name: payload.name,
    };
  }

  async me(userId: string): Promise<AuthUser> {
    const rows = await this.prisma.$queryRaw<UserRow[]>`
      SELECT
        user_id,
        email,
        password_hash,
        role,
        full_name,
        is_active
      FROM app_users
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    const user = rows[0];
    if (!user || !user.is_active) {
      throw new UnauthorizedException('User not found');
    }

    return this.buildAuthUser(user);
  }

  async listUsers(): Promise<UserSummary[]> {
    const rows = await this.prisma.$queryRaw<UserRow[]>`
      SELECT
        user_id,
        email,
        password_hash,
        role,
        full_name,
        is_active
      FROM app_users
      ORDER BY LOWER(full_name) ASC NULLS LAST, LOWER(email) ASC
    `;

    return this.mapUserSummaries(rows);
  }

  async createUser(input: CreateUserInput): Promise<UserSummary> {
    const normalizedEmail = this.normalizeEmail(input.email);
    const normalizedName = this.normalizeName(input.name);
    const normalizedRole = await this.normalizeExistingRole(input.role);
    const password = String(input.password ?? '');

    if (!password.trim()) {
      throw new BadRequestException('Password is required');
    }

    await this.assertEmailAvailable(normalizedEmail);

    const nextUserId = await this.buildNextUserId();
    const insertedRows = await this.prisma.$queryRaw<UserRow[]>`
      INSERT INTO app_users (
        user_id,
        email,
        password_hash,
        role,
        full_name,
        is_active,
        updated_at
      )
      VALUES (
        ${nextUserId},
        ${normalizedEmail},
        ${this.hashPassword(password)},
        ${normalizedRole},
        ${normalizedName},
        ${true},
        NOW()
      )
      RETURNING
        user_id,
        email,
        password_hash,
        role,
        full_name,
        is_active
    `;

    const createdUser = insertedRows[0];
    if (!createdUser) {
      throw new BadRequestException('Failed to create user');
    }

    return this.mapUserSummary(createdUser);
  }

  async updateUser(
    userId: string,
    input: UpdateUserInput,
  ): Promise<UserSummary> {
    const existingUser = await this.findUserRowById(userId);
    const normalizedEmail =
      input.email === undefined
        ? existingUser.email
        : this.normalizeEmail(input.email);
    const normalizedName =
      input.name === undefined
        ? existingUser.full_name
        : this.normalizeName(input.name);
    const normalizedRole =
      input.role === undefined
        ? this.normalizeRole(existingUser.role)
        : await this.normalizeExistingRole(input.role);
    const passwordHash =
      input.password === undefined ||
      input.password === null ||
      input.password === ''
        ? existingUser.password_hash
        : this.hashPassword(input.password);

    if (normalizedEmail !== existingUser.email) {
      await this.assertEmailAvailable(normalizedEmail, userId);
    }

    if (
      this.normalizeRole(existingUser.role) === 'ADMIN' &&
      normalizedRole !== 'ADMIN'
    ) {
      const adminRows = await this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM app_users
        WHERE is_active = TRUE
          AND role = ${'ADMIN'}
      `;

      if ((adminRows[0]?.count ?? 0) <= 1) {
        throw new ForbiddenException('At least one admin user must remain');
      }
    }

    const updatedRows = await this.prisma.$queryRaw<UserRow[]>`
      UPDATE app_users
      SET
        email = ${normalizedEmail},
        password_hash = ${passwordHash},
        role = ${normalizedRole},
        full_name = ${normalizedName},
        updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING
        user_id,
        email,
        password_hash,
        role,
        full_name,
        is_active
    `;

    const updatedUser = updatedRows[0];
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return this.mapUserSummary(updatedUser);
  }

  async deleteUser(userId: string, actorUserId: string): Promise<void> {
    if (userId === actorUserId) {
      throw new ForbiddenException('You cannot delete your own user');
    }

    const existingUser = await this.findUserRowById(userId);
    if (this.normalizeRole(existingUser.role) === 'ADMIN') {
      const adminRows = await this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count
        FROM app_users
        WHERE is_active = TRUE
          AND role = ${'ADMIN'}
      `;

      if ((adminRows[0]?.count ?? 0) <= 1) {
        throw new ForbiddenException('At least one admin user must remain');
      }
    }

    await this.prisma.$executeRaw`
      DELETE FROM app_users
      WHERE user_id = ${userId}
    `;
  }

  async listRoles(): Promise<RoleSummary[]> {
    const rows = await this.prisma.$queryRaw<RoleRow[]>`
      SELECT
        role_key,
        display_name,
        permissions,
        is_system
      FROM app_roles
      ORDER BY display_name ASC, role_key ASC
    `;

    return rows.map((row) => this.mapRoleSummary(row));
  }

  async createRole(input: CreateRoleInput): Promise<RoleSummary> {
    const roleKey = this.normalizeRoleKey(input.roleKey);
    const displayName = this.normalizeRoleDisplayName(input.displayName);
    const permissions = this.normalizePermissions(input.permissions);

    const existingRows = await this.prisma.$queryRaw<{ role_key: string }[]>`
      SELECT role_key
      FROM app_roles
      WHERE role_key = ${roleKey}
      LIMIT 1
    `;

    if (existingRows[0]?.role_key) {
      throw new ConflictException('A role with this key already exists');
    }

    const insertedRows = await this.prisma.$queryRaw<RoleRow[]>`
      INSERT INTO app_roles (
        role_key,
        display_name,
        permissions,
        is_system
      )
      VALUES (
        ${roleKey},
        ${displayName},
        CAST(${JSON.stringify(permissions)} AS JSONB),
        ${false}
      )
      RETURNING
        role_key,
        display_name,
        permissions,
        is_system
    `;

    const createdRole = insertedRows[0];
    if (!createdRole) {
      throw new BadRequestException('Failed to create role');
    }

    return this.mapRoleSummary(createdRole);
  }

  async updateRole(
    roleKey: string,
    input: UpdateRoleInput,
  ): Promise<RoleSummary> {
    const existingRole = await this.findRoleRow(roleKey);
    const displayName =
      input.displayName === undefined
        ? existingRole.display_name
        : this.normalizeRoleDisplayName(input.displayName);
    const permissions =
      input.permissions === undefined
        ? this.normalizePermissions(existingRole.permissions)
        : this.normalizePermissions(input.permissions);

    const updatedRows = await this.prisma.$queryRaw<RoleRow[]>`
      UPDATE app_roles
      SET
        display_name = ${displayName},
        permissions = CAST(${JSON.stringify(permissions)} AS JSONB)
      WHERE role_key = ${existingRole.role_key}
      RETURNING
        role_key,
        display_name,
        permissions,
        is_system
    `;

    const updatedRole = updatedRows[0];
    if (!updatedRole) {
      throw new NotFoundException('Role not found');
    }

    return this.mapRoleSummary(updatedRole);
  }

  private createLoginResult(user: AuthUser): LoginResult {
    const exp = Math.floor(Date.now() / 1000) + this.tokenTtlSeconds;
    const payload: TokenPayload = { ...user, exp };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const signature = this.sign(encodedPayload);

    return {
      token: `${encodedPayload}.${signature}`,
      user,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  private sign(value: string): string {
    return createHmac('sha256', this.tokenSecret)
      .update(value)
      .digest('base64url');
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = scryptSync(password, salt, 64).toString('hex');
    return `scrypt:${salt}:${derivedKey}`;
  }

  private verifyPassword(password: string, hash: string): boolean {
    const [algorithm, salt, expectedHash] = hash.split(':');
    if (algorithm !== 'scrypt' || !salt || !expectedHash) {
      return false;
    }

    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');

    if (candidate.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(candidate, expected);
  }

  private async ensureRolesTable(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS app_roles (
        role_key TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_system BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  private normalizeRole(role: string): AuthRole {
    return this.normalizeRoleKey(role);
  }

  private normalizeEmail(email: string): string {
    const normalizedEmail = String(email ?? '')
      .trim()
      .toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }

    return normalizedEmail;
  }

  private normalizeName(name: string | null | undefined): string | null {
    const normalizedName = String(name ?? '').trim();
    return normalizedName || null;
  }

  private async buildAuthUser(row: UserRow): Promise<AuthUser> {
    return {
      userId: row.user_id,
      email: row.email,
      role: this.normalizeRole(row.role),
      permissions: await this.getPermissionsForRole(row.role),
      name: row.full_name,
    };
  }

  private async mapUserSummary(row: UserRow): Promise<UserSummary> {
    return {
      userId: row.user_id,
      email: row.email,
      role: this.normalizeRole(row.role),
      permissions: await this.getPermissionsForRole(row.role),
      name: row.full_name,
      isActive: row.is_active,
    };
  }

  private async mapUserSummaries(rows: UserRow[]): Promise<UserSummary[]> {
    const permissionsByRole = await this.getPermissionsByRole(
      rows.map((row) => row.role),
    );

    return rows.map((row) => {
      const normalizedRole = this.normalizeRole(row.role);

      return {
        userId: row.user_id,
        email: row.email,
        role: normalizedRole,
        permissions: permissionsByRole.get(normalizedRole) ?? [],
        name: row.full_name,
        isActive: row.is_active,
      };
    });
  }

  private mapRoleSummary(row: RoleRow): RoleSummary {
    return {
      roleKey: this.normalizeRole(row.role_key),
      displayName: row.display_name,
      permissions: this.normalizePermissions(row.permissions),
      isSystem: row.is_system,
    };
  }

  private async buildNextUserId(): Promise<string> {
    const rows = await this.prisma.$queryRaw<{ user_id: string }[]>`
      WITH numeric_ids AS (
        SELECT COALESCE(MAX(CAST(SUBSTRING(user_id FROM '^U-(\\d+)$') AS INTEGER)), 0) AS n
        FROM app_users
        WHERE user_id ~ '^U-\\d+$'
      )
      SELECT 'U-' || LPAD((n + 1)::text, 3, '0') AS user_id
      FROM numeric_ids
    `;

    return rows[0]?.user_id ?? `U-${Date.now()}`;
  }

  private async assertEmailAvailable(
    email: string,
    excludeUserId?: string,
  ): Promise<void> {
    const existingRows = excludeUserId
      ? await this.prisma.$queryRaw<{ user_id: string }[]>`
          SELECT user_id
          FROM app_users
          WHERE email = ${email}
            AND user_id <> ${excludeUserId}
          LIMIT 1
        `
      : await this.prisma.$queryRaw<{ user_id: string }[]>`
          SELECT user_id
          FROM app_users
          WHERE email = ${email}
          LIMIT 1
        `;

    if (existingRows[0]?.user_id) {
      throw new ConflictException('A user with this email already exists');
    }
  }

  private async findUserRowById(userId: string): Promise<UserRow> {
    const rows = await this.prisma.$queryRaw<UserRow[]>`
      SELECT
        user_id,
        email,
        password_hash,
        role,
        full_name,
        is_active
      FROM app_users
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    const user = rows[0];
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private normalizeRoleKey(role: string): string {
    const normalizedRole = String(role ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_');
    if (!normalizedRole) {
      throw new BadRequestException('Role is required');
    }

    return normalizedRole;
  }

  private normalizeRoleDisplayName(displayName: string): string {
    const normalizedDisplayName = String(displayName ?? '').trim();
    if (!normalizedDisplayName) {
      throw new BadRequestException('Role name is required');
    }

    return normalizedDisplayName;
  }

  private normalizePermissions(permissions: unknown): PermissionKey[] {
    if (!Array.isArray(permissions)) {
      return [];
    }

    // Legacy role seeds used coarse capability names. Expand them here so both
    // old and new records resolve to the same canonical permission set.
    return Array.from(
      new Set(
        permissions.flatMap((permission) => {
          const normalizedPermission = String(permission ?? '').trim();
          if (PERMISSION_KEYS.includes(normalizedPermission as PermissionKey)) {
            return [normalizedPermission as PermissionKey];
          }

          return LEGACY_PERMISSION_EXPANSIONS[normalizedPermission] ?? [];
        }),
      ),
    );
  }

  private async normalizeExistingRole(role: string): Promise<string> {
    const normalizedRole = this.normalizeRoleKey(role);
    await this.findRoleRow(normalizedRole);
    return normalizedRole;
  }

  private async getPermissionsForRole(role: string): Promise<PermissionKey[]> {
    const roleRow = await this.findRoleRow(role);
    return this.normalizePermissions(roleRow.permissions);
  }

  private async getPermissionsByRole(
    roleKeys: string[],
  ): Promise<Map<string, PermissionKey[]>> {
    const normalizedRoleKeys = Array.from(
      new Set(roleKeys.map((roleKey) => this.normalizeRoleKey(roleKey))),
    );

    if (normalizedRoleKeys.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.$queryRaw<RoleRow[]>`
      SELECT
        role_key,
        display_name,
        permissions,
        is_system
      FROM app_roles
      WHERE role_key IN (${Prisma.join(normalizedRoleKeys)})
    `;

    // listUsers() can return many rows for the same role, so resolve each role once
    // and reuse that permission list across the whole response.
    return new Map(
      rows.map((row) => [
        this.normalizeRole(row.role_key),
        this.normalizePermissions(row.permissions),
      ]),
    );
  }

  private async findRoleRow(roleKey: string): Promise<RoleRow> {
    const normalizedRoleKey = this.normalizeRoleKey(roleKey);
    const rows = await this.prisma.$queryRaw<RoleRow[]>`
      SELECT
        role_key,
        display_name,
        permissions,
        is_system
      FROM app_roles
      WHERE role_key = ${normalizedRoleKey}
      LIMIT 1
    `;

    const role = rows[0];
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  private async ensureUsersTable(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS app_users (
        user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'ADMIN',
        full_name TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  private async ensureDefaultRoles(): Promise<void> {
    await this.ensureDefaultRole({
      roleKey: DEFAULT_ROLE_KEYS[0],
      displayName: 'Admin',
      permissions: [
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
        'view_strategies',
        'add_strategies',
        'submit_projects',
        'review_proposals',
        'add_initiatives',
        'manage_risks',
      ],
      isSystem: true,
    });

    await this.ensureDefaultRole({
      roleKey: DEFAULT_ROLE_KEYS[1],
      displayName: 'Executive',
      permissions: [
        'view_portfolio_dashboard_all',
        'view_portfolio_dashboard_owned',
        'view_all_initiatives',
        'view_owned_initiatives',
        'edit_owned_initiatives',
        'view_all_projects',
        'view_owned_projects',
        'edit_owned_projects',
        'submit_status_updates',
        'archive_records',
        'approve_portfolio_decisions',
        'view_strategies',
        'add_strategies',
        'submit_projects',
        'review_proposals',
        'add_initiatives',
      ],
      isSystem: true,
    });

    await this.ensureDefaultRole({
      roleKey: DEFAULT_ROLE_KEYS[2],
      displayName: 'Business Owner',
      permissions: [
        'view_portfolio_dashboard_owned',
        'view_owned_initiatives',
        'view_owned_projects',
        'submit_status_updates',
        'view_strategies',
        'submit_projects',
        'add_initiatives',
        'manage_risks',
      ],
      isSystem: true,
    });
  }

  private async ensureDefaultRole({
    roleKey,
    displayName,
    permissions,
    isSystem,
  }: {
    roleKey: string;
    displayName: string;
    permissions: PermissionKey[];
    isSystem: boolean;
  }): Promise<void> {
    const normalizedRoleKey = this.normalizeRoleKey(roleKey);
    const normalizedPermissions = this.normalizePermissions(permissions);
    const rows = await this.prisma.$queryRaw<{ role_key: string }[]>`
      SELECT role_key
      FROM app_roles
      WHERE role_key = ${normalizedRoleKey}
      LIMIT 1
    `;

    if (rows[0]?.role_key) {
      await this.prisma.$executeRaw`
        UPDATE app_roles
        SET
          display_name = ${displayName},
          permissions = CAST(${JSON.stringify(normalizedPermissions)} AS JSONB),
          is_system = ${isSystem},
          updated_at = NOW()
        WHERE role_key = ${normalizedRoleKey}
      `;
      return;
    }

    await this.prisma.$executeRaw`
      INSERT INTO app_roles (
        role_key,
        display_name,
        permissions,
        is_system
      )
      VALUES (
        ${normalizedRoleKey},
        ${displayName},
        CAST(${JSON.stringify(normalizedPermissions)} AS JSONB),
        ${isSystem}
      )
    `;
  }

  private async ensureDefaultUsers(): Promise<void> {
    await this.ensureDefaultUser({
      userId: 'U-ADMIN',
      email: process.env.ADMIN_EMAIL ?? 'admin@riskapp.local',
      password: process.env.ADMIN_PASSWORD ?? 'Admin123!',
      name: process.env.ADMIN_NAME ?? 'PPM Administrator',
      role: 'ADMIN',
    });

    await this.ensureDefaultUser({
      userId: 'U-EXEC',
      email: process.env.EXECUTIVE_EMAIL ?? 'executive@riskapp.local',
      password: process.env.EXECUTIVE_PASSWORD ?? 'Executive123!',
      name: process.env.EXECUTIVE_NAME ?? 'PPM Executive',
      role: 'EXECUTIVE',
    });

    await this.ensureDefaultUser({
      userId: 'U-OWNER',
      email: process.env.BUSINESS_OWNER_EMAIL ?? 'owner@riskapp.local',
      password: process.env.BUSINESS_OWNER_PASSWORD ?? 'Owner123!',
      name: process.env.BUSINESS_OWNER_NAME ?? 'PPM Business Owner',
      role: 'BUSINESS_OWNER',
    });
  }

  private async ensureDefaultUser({
    userId,
    email,
    password,
    name,
    role,
  }: {
    userId: string;
    email: string;
    password: string;
    name: string;
    role: AuthRole;
  }): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim() || null;

    const rows = await this.prisma.$queryRaw<{ user_id: string }[]>`
      SELECT user_id
      FROM app_users
      WHERE email = ${normalizedEmail}
      LIMIT 1
    `;

    if (rows[0]?.user_id) {
      await this.prisma.$executeRaw`
        UPDATE app_users
        SET
          full_name = ${normalizedName},
          role = ${role}
        WHERE email = ${normalizedEmail}
      `;
      return;
    }

    await this.prisma.$executeRaw`
      INSERT INTO app_users (
        user_id,
        email,
        password_hash,
        role,
        full_name
      )
      VALUES (
        ${userId},
        ${normalizedEmail},
        ${this.hashPassword(password)},
        ${role},
        ${normalizedName}
      )
    `;

    this.logger.log(
      `Seeded default ${role.toLowerCase()} user: ${normalizedEmail}`,
    );
  }
}
