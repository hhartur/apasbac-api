import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
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

  @Get('security/overview')
  @ApiOperation({ summary: 'Resumo de eventos de segurança recentes (Admin)',
    description: 'Monitoramento: total de falhas, contagem por ação de segurança (logins falhos, reuso de refresh, ' +
      '403, 429, 500) e os IPs com mais falhas, na janela informada. Somente leitura; nenhum dado pessoal é exposto.' })
  @ApiQuery({ name: 'hours', required: false, type: Number, description: 'Janela em horas (1–720, padrão 24)' })
  securityOverview(@Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours: number) {
    return this.audit.securityOverview(Math.min(720, Math.max(1, hours)));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um registro de auditoria (Admin)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.audit.findOne(id); }
}
