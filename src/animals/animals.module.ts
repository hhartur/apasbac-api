import { Module } from '@nestjs/common';
import { AnimalsController } from './animals.controller';
import { AnimalsService } from './animals.service';
import { StorageModule } from '../storage/storage.module';
import { ConfigAppModule } from '../config-app/config-app.module';

@Module({ imports: [StorageModule, ConfigAppModule], controllers: [AnimalsController], providers: [AnimalsService] })
export class AnimalsModule {}
