import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@ApiTags('Audit')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Lista registros de auditoria com filtros (Admin)',
    description: 'Somente leitura. Não existem endpoints para alterar ou apagar registros de auditoria.' })
  findAll(@Query() query: AuditQueryDto) { return this.audit.findAll(query); }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um registro de auditoria (Admin)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.audit.findOne(id); }
}
