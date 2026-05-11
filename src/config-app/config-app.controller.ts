import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigAppService } from './config-app.service';
import { CreateConfigDto, UpdateConfigDto } from './dto/config.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';

@ApiTags('Config')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.STAFF)
@Controller('configs')
export class ConfigAppController {
  constructor(private configService: ConfigAppService) {}

  @Post()
  @ApiOperation({ summary: 'Cria nova configuração (Admin/Staff)' })
  create(@Body() dto: CreateConfigDto) { return this.configService.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Lista todas as configurações (Admin/Staff)' })
  findAll() { return this.configService.findAll(); }

  @Get(':key')
  @ApiOperation({ summary: 'Busca configuração por chave (Admin/Staff)' })
  findOne(@Param('key') key: string) { return this.configService.findOne(key); }

  @Patch(':key')
  @ApiOperation({ summary: 'Edita configuração (Admin/Staff)' })
  update(@Param('key') key: string, @Body() dto: UpdateConfigDto) { return this.configService.update(key, dto); }

  @Delete(':key')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Remove configuração (Admin)' })
  remove(@Param('key') key: string) { return this.configService.remove(key); }
}
