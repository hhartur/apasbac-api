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

@ApiTags('Monitor')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('monitoring')
export class MonitorController {
  constructor(private monitorService: MonitorService) { }

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Cria um registro de monitoramento para um tutor (Admin/Staff)' })
  create(@Body() dto: CreateMonitoringDto) {
    return this.monitorService.create(dto);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  async submitMonitoring(
    @Param('id') id: string,
    @Body() dto: SubmitMonitoringDto,
    @Request() req,
  ) {
    return this.monitorService.submitMonitoring(id, dto, req.user);
  }

  @Patch(':id/review')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Aprova ou rejeita o envio do tutor (Admin/Staff)' })
  review(@Param('id') id: string, @Body() dto: ReviewMonitoringDto) {
    return this.monitorService.review(id, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Lista todos os monitoramentos (Admin/Staff)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: MonitoringStatus })
  findAll(@Query('page') page = 1, @Query('limit') limit = 20, @Query('status') status?: MonitoringStatus) {
    return this.monitorService.findAll(+page, +limit, status);
  }

  @Get('mine')
  @Roles(Role.TUTOR)
  @ApiOperation({ summary: 'Lista os monitoramentos do tutor autenticado' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findMine(@CurrentUser() user: any, @Query('page') page = 1, @Query('limit') limit = 10) {
    return this.monitorService.findMine(user.id, +page, +limit);
  }

  // TUTOR pode ver o próprio monitoramento; Admin/Staff veem qualquer um
  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.TUTOR)
  @ApiOperation({ summary: 'Busca monitoramento por ID (Admin/Staff/Tutor)' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.monitorService.findOne(id, user.id, user.role);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Remove monitoramento e mídias (Admin)' })
  remove(@Param('id') id: string) { return this.monitorService.remove(id); }
}