import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import {
  AuthService,
  type CreateUserInput,
  type CreateRoleInput,
  type UpdateRoleInput,
  type UpdateUserInput,
} from './auth.service';
import { Public } from './public.decorator';
import { Permissions } from './permissions.decorator';

type LoginBody = {
  email?: string;
  password?: string;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: LoginBody) {
    return this.authService.login(body.email ?? '', body.password ?? '');
  }

  @Get('me')
  async me(@Req() req: { user: { userId: string } }) {
    const user = await this.authService.me(req.user.userId);
    return { user };
  }

  @Permissions('manage_users')
  @Get('users')
  async listUsers() {
    const users = await this.authService.listUsers();
    return { users };
  }

  @Permissions('manage_users')
  @Post('users')
  async createUser(@Body() body: CreateUserInput) {
    const user = await this.authService.createUser(body);
    return { user };
  }

  @Permissions('manage_users')
  @Put('users/:userId')
  async updateUser(
    @Param('userId') userId: string,
    @Body() body: UpdateUserInput,
  ) {
    const user = await this.authService.updateUser(userId, body);
    return { user };
  }

  @Permissions('manage_users')
  @Delete('users/:userId')
  async deleteUser(
    @Param('userId') userId: string,
    @Req() req: { user: { userId: string } },
  ) {
    await this.authService.deleteUser(userId, req.user.userId);
    return { success: true };
  }

  @Permissions('manage_users')
  @Get('roles')
  async listRoles() {
    const roles = await this.authService.listRoles();
    return { roles };
  }

  @Permissions('manage_users')
  @Post('roles')
  async createRole(@Body() body: CreateRoleInput) {
    const role = await this.authService.createRole(body);
    return { role };
  }

  @Permissions('manage_users')
  @Put('roles/:roleKey')
  async updateRole(
    @Param('roleKey') roleKey: string,
    @Body() body: UpdateRoleInput,
  ) {
    const role = await this.authService.updateRole(roleKey, body);
    return { role };
  }
}
