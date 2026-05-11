import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFiles, Query, ParseIntPipe } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { AnimalsService } from './animals.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Role } from '../common/enums';
import { memoryStorage } from 'multer';

@ApiTags('Animals')
@Controller('animals')
export class AnimalsController {
  constructor(private animalsService: AnimalsService) {}

  @Get('public/uuid/:uuid')
  @Public()
  @ApiOperation({ summary: '[Público] Informações do animal via UUID (QR Code) — inclui contato da APASBAC e tutor' })
  findByUuid(@Param('uuid') uuid: string) { return this.animalsService.findByUuid(uuid); }

  @Get('public/:id')
  @Public()
  @ApiOperation({ summary: '[Público] Informações básicas do animal por ID (sem dados de contato)' })
  findPublic(@Param('id', ParseIntPipe) id: number) { return this.animalsService.findPublicById(id); }

  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Lista todos os animais (Admin/Staff)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'isAdopted', required: false, type: Boolean })
  findAll(@Query('page') page = 1, @Query('limit') limit = 20, @Query('isAdopted') isAdopted?: boolean) {
    return this.animalsService.findAll(+page, +limit, isAdopted);
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Busca animal completo por ID numérico (Admin/Staff)' })
  findOne(@Param('id', ParseIntPipe) id: number) { return this.animalsService.findOne(id); }

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @UseInterceptors(FilesInterceptor('photos', 3, { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Cadastra novo animal (Admin/Staff)' })
  @ApiBody({ description: 'Dados do animal + fotos (máx. 3)', type: CreateAnimalDto })
  create(@Body() dto: CreateAnimalDto, @UploadedFiles() photos: Express.Multer.File[]) {
    return this.animalsService.create(dto, photos || []);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @UseInterceptors(FilesInterceptor('photos', 3, { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Edita animal (Admin/Staff)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAnimalDto, @UploadedFiles() photos: Express.Multer.File[]) {
    return this.animalsService.update(id, dto, photos);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Remove animal (Admin)' })
  remove(@Param('id', ParseIntPipe) id: number) { return this.animalsService.remove(id); }

  @Post(':id/qrcode/regenerate')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Re-gera QR Code do animal com link UUID (Admin/Staff)' })
  regenerateQrCode(@Param('id', ParseIntPipe) id: number) { return this.animalsService.regenerateQrCode(id); }

  @Post(':id/adopter')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Vincula tutor ao animal após adoção (Admin/Staff)' })
  @ApiBody({ schema: { type: 'object', properties: { userId: { type: 'string', format: 'uuid' } } } })
  linkAdopter(@Param('id', ParseIntPipe) id: number, @Body('userId') userId: string) {
    return this.animalsService.linkAdopter(id, userId);
  }
}
