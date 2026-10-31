import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFiles, Query, ParseIntPipe, ParseUUIDPipe } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { AnimalsService } from './animals.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { LinkAdopterDto } from './dto/link-adopter.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';
import { imageUploadOptions } from '../common/uploads';
import { Audited } from '../audit/audit.interceptor';
import { ApiEnvelope } from '../common/swagger';
import { AnimalResponse, MessageResponse, PublicAnimalResponse, QrAnimalResponse, QrCodeResponse } from '../common/dto/responses';

@ApiTags('Animals')
@Controller('animals')
export class AnimalsController {
  constructor(private animalsService: AnimalsService) {}

  @Get('public/uuid/:uuid')
  @Public()
  @ApiOperation({ summary: '[Público] Informações do animal via UUID (QR Code) — inclui contato da APASBAC e tutor',
    description: 'O UUID funciona como chave do QR Code da coleira. Contatos da APASBAC vêm das configs apasbac_phone/apasbac_email; ' +
      'o contato do tutor só é retornado quando o animal está adotado. O endereço da APASBAC nunca é retornado.' })
  @ApiEnvelope(QrAnimalResponse)
  findByUuid(@Param('uuid', ParseUUIDPipe) uuid: string) { return this.animalsService.findByUuid(uuid); }

  @Get('public/:id')
  @Public()
  @ApiOperation({ summary: '[Público] Informações básicas do animal por ID (sem dados de contato)' })
  @ApiEnvelope(PublicAnimalResponse)
  findPublic(@Param('id', ParseIntPipe) id: number) { return this.animalsService.findPublicById(id); }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Lista todos os animais (público; token opcional)',
    description: 'Sem token: lista pública, sem uuid, qrCodeUrl e dados do adotante. Com token de ADMIN/STAFF: dados completos. ' +
      'Com token de outro perfil: dados completos apenas dos animais adotados pelo próprio usuário. Token enviado e inválido retorna 401.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Máximo 100' })
  @ApiQuery({ name: 'isAdopted', required: false, type: Boolean })
  @ApiEnvelope(AnimalResponse, { paginated: true })
  findAll(@CurrentUser() user: any, @Query('page') page = 1, @Query('limit') limit = 20, @Query('isAdopted') isAdopted?: boolean) {
    return this.animalsService.findAll(Math.max(1, +page || 1), Math.min(100, Math.max(1, +limit || 20)), isAdopted, user);
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Busca animal completo por ID numérico (Admin/Staff)' })
  @ApiEnvelope(AnimalResponse)
  findOne(@Param('id', ParseIntPipe) id: number) { return this.animalsService.findOne(id); }

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @UseInterceptors(FilesInterceptor('photos', 3, imageUploadOptions(3)))
  @Audited({ action: 'ANIMAL_CREATE', resource: 'animal' })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiOperation({ summary: 'Cadastra novo animal (Admin/Staff)',
    description: 'JSON com photoUrls (URLs já enviadas ao Cloudinary via /storage/signed-upload, máx. 3) ou multipart com até 3 arquivos ' +
      'em photos (JPEG/PNG/WebP, 8 MB cada, conteúdo verificado). Gera e armazena o QR Code automaticamente.' })
  @ApiBody({ description: 'Dados do animal + fotos (máx. 3) ou photoUrls', type: CreateAnimalDto })
  @ApiEnvelope(AnimalResponse, { status: 201 })
  create(
    @Body() dto: CreateAnimalDto,
    @UploadedFiles() photos?: Express.Multer.File[],
  ) {
    return this.animalsService.create(dto, photos ?? []);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @UseInterceptors(FilesInterceptor('photos', 3, imageUploadOptions(3)))
  @Audited({ action: 'ANIMAL_UPDATE', resource: 'animal' })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiOperation({ summary: 'Edita animal (Admin/Staff)', description: 'Se arquivos forem enviados em photos, substituem todas as fotos atuais (as antigas são apagadas do storage).' })
  @ApiEnvelope(AnimalResponse)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnimalDto,
    @UploadedFiles() photos: Express.Multer.File[],
  ) {
    return this.animalsService.update(id, dto, photos);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Audited({ action: 'ANIMAL_DELETE', resource: 'animal' })
  @ApiOperation({ summary: 'Remove animal (Admin)', description: 'Apaga também fotos e QR Code do storage. Retorna 409 se houver monitoramentos vinculados.' })
  @ApiEnvelope(MessageResponse)
  remove(@Param('id', ParseIntPipe) id: number) { return this.animalsService.remove(id); }

  @Post(':id/qrcode/regenerate')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Audited({ action: 'ANIMAL_QRCODE_REGENERATE', resource: 'animal' })
  @ApiOperation({ summary: 'Re-gera QR Code do animal com link UUID (Admin/Staff)' })
  @ApiEnvelope(QrCodeResponse, { status: 201 })
  regenerateQrCode(@Param('id', ParseIntPipe) id: number) { return this.animalsService.regenerateQrCode(id); }

  @Post(':id/adopter')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Audited({ action: 'ADOPTION_LINK', resource: 'animal' })
  @ApiOperation({ summary: 'Vincula tutor ao animal após adoção (Admin/Staff)',
    description: 'Marca o animal como adotado. Um usuário com role USER passa a TUTOR; roles ADMIN/STAFF/TUTOR são mantidas.' })
  @ApiEnvelope(AnimalResponse, { status: 201 })
  linkAdopter(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LinkAdopterDto,
  ) {
    return this.animalsService.linkAdopter(id, dto.userId);
  }
}
