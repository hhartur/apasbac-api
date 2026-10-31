import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { AdminEventsController, EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({ imports: [StorageModule], controllers: [EventsController, AdminEventsController], providers: [EventsService] })
export class EventsModule {}
