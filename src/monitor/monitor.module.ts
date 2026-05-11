import { Module } from '@nestjs/common';
import { MonitorController } from './monitor.controller';
import { MonitorService } from './monitor.service';
import { StorageModule } from '../storage/storage.module';
import { SheetsModule } from '../sheets/sheets.module';
import { MailModule } from '../mail/mail.module';
import { ConfigAppModule } from '../config-app/config-app.module';

@Module({
  imports: [StorageModule, SheetsModule, MailModule, ConfigAppModule],
  controllers: [MonitorController],
  providers: [MonitorService],
})
export class MonitorModule { }
