import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppVersionService } from './app-version.service';
import { AppVersionController } from './app-version.controller';
import { AppVersionInterceptor } from './app-version.interceptor';

@Module({ controllers: [AppVersionController],
  providers: [AppVersionService, { provide: APP_INTERCEPTOR, useClass: AppVersionInterceptor }] })
export class AppVersionModule {}
