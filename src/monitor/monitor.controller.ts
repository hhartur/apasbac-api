import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFiles, Query, Request } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { MonitorService } from './monitor.service';
import { CreateMonitoringDto } from './dto/create-monitoring.dto';
import { ReviewMonitoringDto } from './dto/review-monitoring.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role, MonitoringStatus } from '../common/enums';
import { memoryStorage } from 'multer';
import { SubmitMonitoringDto } from './dto/submit-monitoring.dto';
import { Audited } from '../audit/audit.interceptor';
import { ApiEnvelope } from '../common/swagger';
import { MessageResponse, MonitoringResponse } from '../common/dto/responses';

@ApiTags('Monitor')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('monitoring')
export class MonitorController {
  constructor(private monitorService: MonitorService) { }

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  @Audited({ action: 'MONITORING_CREATE', resource: 'monitoring' })
  @ApiOperation({ summary: 'Cria um registro de monitoramento para um tutor (Admin/Staff)', description: 'dueDate é calculado pelas configs monitoring_period_value e monitoring_period_unit.' })
  @ApiEnvelope(MonitoringResponse, { status: 201 })
  create(@Body() dto: CreateMonitoringDto) {
    return this.monitorService.create(dto);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  @Audited({ action: 'MONITORING_SUBMIT', resource: 'monitoring' })
  @ApiOperation({ summary: 'Tutor envia vídeo e imagens do monitoramento',
    description: 'Somente o usuário dono do monitoramento, com status PENDING. As URLs devem vir do upload direto ' +
      '(POST /storage/signed-upload, pastas monitoring/videos e monitoring/images) e pertencer à conta Cloudinary da API.' })
  @ApiEnvelope(MonitoringResponse, { status: 201 })
  async submitMonitoring(
    @Param('id') id: string,
    @Body() dto: SubmitMonitoringDto,
    @Request() req,
  ) {
    return this.monitorService.submitMonitoring(id, dto, req.user);
  }

  @Patch(':id/review')
  @Roles(Role.ADMIN, Role.STAFF)
  @Audited({ action: (b) => (b?.approved === true ? 'MONITORING_APPROVE' : 'MONITORING_REJECT'), resource: 'monitoring' })
  @ApiOperation({ summary: 'Aprova ou rejeita o envio do tutor (Admin/Staff)', description: 'Envia e-mail ao tutor, atualiza a planilha (se configurada) e apaga vídeo e imagens do storage.' })
  @ApiEnvelope(MonitoringResponse)
  review(@Param('id') id: string, @Body() dto: ReviewMonitoringDto) {
    return this.monitorService.review(id, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Lista todos os monitoramentos (Admin/Staff)' })
  @ApiEnvelope(MonitoringResponse, { paginated: true })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: MonitoringStatus })
  findAll(@Query('page') page = 1, @Query('limit') limit = 20, @Query('status') status?: MonitoringStatus) {
    return this.monitorService.findAll(Math.max(1, +page || 1), Math.min(100, Math.max(1, +limit || 20)), status);
  }

  @Get('mine')
  @Roles(Role.TUTOR)
  @ApiOperation({ summary: 'Lista os monitoramentos do tutor autenticado', description: 'Retorna uma lista simples (sem total/totalPages).' })
  @ApiEnvelope(MonitoringResponse, { isArray: true })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findMine(@CurrentUser() user: any, @Query('page') page = 1, @Query('limit') limit = 10) {
    return this.monitorService.findMine(user.id, Math.max(1, +page || 1), Math.min(100, Math.max(1, +limit || 10)));
  }

  // TUTOR pode ver o próprio monitoramento; Admin/Staff veem qualquer um
  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.TUTOR)
  @ApiOperation({ summary: 'Busca monitoramento por ID (Admin/Staff/Tutor)', description: 'TUTOR só acessa os próprios (403 nos demais).' })
  @ApiEnvelope(MonitoringResponse)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.monitorService.findOne(id, user.id, user.role);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @Audited({ action: 'MONITORING_DELETE', resource: 'monitoring' })
  @ApiOperation({ summary: 'Remove monitoramento e mídias (Admin)' })
  @ApiEnvelope(MessageResponse)
  remove(@Param('id') id: string) { return this.monitorService.remove(id); }
}