import { Module } from '@nestjs/common';
import { DueSoonScheduler } from './due-soon.scheduler';
import { NotificationListeners } from './notification.listeners';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationListeners, DueSoonScheduler],
  exports: [NotificationsService],
})
export class NotificationsModule {}
