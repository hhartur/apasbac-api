import { Controller, Get, Patch, Delete, Param, Body, UseGuards, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto, UpdateUserRoleDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';
import { Audited } from '../audit/audit.interceptor';
import { ApiEnvelope } from '../common/swagger';
import { MessageResponse, UserResponse } from '../common/dto/responses';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Retorna dados do usuário autenticado', description: 'Inclui adoptedAnimals (animais vinculados ao usuário). Nunca retorna a senha.' })
  @ApiEnvelope(UserResponse)
  me(@CurrentUser() user: any) { return this.usersService.me(user.id); }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Lista todos os usuários (Admin/Staff)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiEnvelope(UserResponse, { paginated: true })
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.usersService.findAll(Math.max(1, +page || 1), Math.min(100, Math.max(1, +limit || 20)));
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Busca usuário por ID (Admin/Staff)' })
  @ApiEnvelope(UserResponse)
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.usersService.findOne(id); }

  @Patch(':id')
  @Audited({ action: 'USER_UPDATE', resource: 'user' })
  @ApiOperation({ summary: 'Atualiza dados do usuário (próprio ou Admin/Staff)',
    description: 'Somente fullName e phone. Um usuário comum só altera o próprio cadastro; STAFF não altera dados de ADMIN.' })
  @ApiEnvelope(UserResponse)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: any) {
    return this.usersService.update(id, dto, user);
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  @Audited({ action: 'USER_ROLE_UPDATE', resource: 'user' })
  @ApiOperation({ summary: 'Altera role do usuário (Admin)', description: 'Um ADMIN não pode alterar a própria role.' })
  @ApiEnvelope(UserResponse)
  updateRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserRoleDto, @CurrentUser() user: any) {
    return this.usersService.updateRole(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @Audited({ action: 'USER_DELETE', resource: 'user' })
  @ApiOperation({ summary: 'Remove usuário (Admin)', description: 'Retorna 409 se o usuário tiver monitoramentos vinculados. Um ADMIN não pode remover a si mesmo.' })
  @ApiEnvelope(MessageResponse)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) { return this.usersService.remove(id, user); }
}
