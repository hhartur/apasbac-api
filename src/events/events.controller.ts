import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';
import { imageUploadOptions } from '../common/uploads';
import { Audited } from '../audit/audit.interceptor';
import { ApiEnvelope } from '../common/swagger';
import { EventsService } from './events.service';
import { EventCategoryResponse, EventResponse } from './dto/event-response.dto';
import {
  AdminEventQueryDto, CreateEventCategoryDto, CreateEventDto, MAX_GALLERY, PublicEventQueryDto,
  RemoveGalleryImageDto, UpdateEventCategoryDto, UpdateEventDto,
} from './dto/event.dto';

const STAFF = [Role.ADMIN, Role.STAFF];

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @ApiOperation({ summary: '[Público] Lista eventos publicados, cancelados e encerrados', description: 'Rascunhos nunca aparecem.' })
  @ApiEnvelope(EventResponse, { paginated: true })
  findAll(@Query() q: PublicEventQueryDto) { return this.events.findPublic(q); }

  @Get('categories')
  @ApiOperation({ summary: '[Público] Lista categorias de eventos' })
  @ApiEnvelope(EventCategoryResponse, { isArray: true })
  categories() { return this.events.findCategories(); }

  @Get('slug/:slug')
  @ApiOperation({ summary: '[Público] Consulta evento por slug' })
  @ApiEnvelope(EventResponse)
  findBySlug(@Param('slug') slug: string) { return this.events.findPublicOne({ slug }); }

  @Get(':id')
  @ApiOperation({ summary: '[Público] Consulta evento por ID' })
  @ApiEnvelope(EventResponse)
  findOne(@Param('id', ParseIntPipe) id: number) { return this.events.findPublicOne({ id }); }

  @Post('categories')
  @ApiBearerAuth('access-token') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN)
  @Audited({ action: 'EVENT_CATEGORY_CREATE', resource: 'event_category' })
  @ApiOperation({ summary: 'Cria categoria de evento (Admin)' })
  @ApiEnvelope(EventCategoryResponse, { status: 201 })
  createCategory(@Body() dto: CreateEventCategoryDto) { return this.events.createCategory(dto); }

  @Patch('categories/:id')
  @ApiBearerAuth('access-token') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN)
  @Audited({ action: 'EVENT_CATEGORY_UPDATE', resource: 'event_category' })
  @ApiOperation({ summary: 'Edita categoria de evento (Admin)' })
  @ApiEnvelope(EventCategoryResponse)
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEventCategoryDto) { return this.events.updateCategory(id, dto); }

  @Delete('categories/:id')
  @ApiBearerAuth('access-token') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN)
  @Audited({ action: 'EVENT_CATEGORY_DELETE', resource: 'event_category' })
  @ApiOperation({ summary: 'Remove categoria (Admin)', description: '409 se houver eventos na categoria.' })
  removeCategory(@Param('id', ParseIntPipe) id: number) { return this.events.removeCategory(id); }

  @Post()
  @ApiBearerAuth('access-token') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...STAFF)
  @Audited({ action: 'EVENT_CREATE', resource: 'event' })
  @ApiOperation({ summary: 'Cria evento (Admin/Staff)', description: 'Status padrão DRAFT.' })
  @ApiEnvelope(EventResponse, { status: 201 })
  create(@Body() dto: CreateEventDto, @CurrentUser() user: any) { return this.events.create(dto, user.id); }

  @Patch(':id')
  @ApiBearerAuth('access-token') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...STAFF)
  @Audited({ action: 'EVENT_UPDATE', resource: 'event' })
  @ApiOperation({ summary: 'Atualiza evento (Admin/Staff)' })
  @ApiEnvelope(EventResponse)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEventDto) { return this.events.update(id, dto); }

  @Delete(':id')
  @ApiBearerAuth('access-token') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN)
  @Audited({ action: 'EVENT_DELETE', resource: 'event' })
  @ApiOperation({ summary: 'Exclui evento e imagens (Admin)', description: 'Para manter histórico use status CANCELLED ou FINISHED.' })
  remove(@Param('id', ParseIntPipe) id: number) { return this.events.remove(id); }

  @Post(':id/image')
  @ApiBearerAuth('access-token') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...STAFF)
  @UseInterceptors(FileInterceptor('image', imageUploadOptions(1)))
  @Audited({ action: 'EVENT_IMAGE_UPLOAD', resource: 'event' })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Envia/substitui imagem de capa (Admin/Staff)', description: 'Campo image: JPEG/PNG/WebP até 8 MB, conteúdo verificado.' })
  @ApiEnvelope(EventResponse, { status: 201 })
  setCover(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File) { return this.events.setCover(id, file); }

  @Delete(':id/image')
  @ApiBearerAuth('access-token') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...STAFF)
  @Audited({ action: 'EVENT_IMAGE_DELETE', resource: 'event' })
  @ApiOperation({ summary: 'Remove imagem de capa (Admin/Staff)' })
  @ApiEnvelope(EventResponse)
  removeCover(@Param('id', ParseIntPipe) id: number) { return this.events.removeCover(id); }

  @Post(':id/gallery')
  @ApiBearerAuth('access-token') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...STAFF)
  @UseInterceptors(FilesInterceptor('images', MAX_GALLERY, imageUploadOptions(MAX_GALLERY)))
  @Audited({ action: 'EVENT_GALLERY_ADD', resource: 'event' })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Adiciona imagens à galeria (Admin/Staff)', description: `Campo images; máximo ${MAX_GALLERY} no total.` })
  @ApiEnvelope(EventResponse, { status: 201 })
  addGallery(@Param('id', ParseIntPipe) id: number, @UploadedFiles() files: Express.Multer.File[]) { return this.events.addGallery(id, files); }

  @Delete(':id/gallery')
  @ApiBearerAuth('access-token') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...STAFF)
  @Audited({ action: 'EVENT_GALLERY_REMOVE', resource: 'event' })
  @ApiOperation({ summary: 'Remove imagem da galeria (Admin/Staff)' })
  @ApiEnvelope(EventResponse)
  removeGallery(@Param('id', ParseIntPipe) id: number, @Body() dto: RemoveGalleryImageDto) { return this.events.removeGallery(id, dto.url); }
}

@ApiTags('Events')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF)
@Controller('admin/events')
export class AdminEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista administrativa de eventos, inclui rascunhos (Admin/Staff)' })
  @ApiEnvelope(EventResponse, { paginated: true })
  findAll(@Query() q: AdminEventQueryDto) { return this.events.findAdmin(q); }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta administrativa de evento, inclui rascunhos (Admin/Staff)' })
  @ApiEnvelope(EventResponse)
  findOne(@Param('id', ParseIntPipe) id: number) { return this.events.findAdminOne(id); }
}
