import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Attachment, WorkspaceRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Events, FilesOrphanedEvent } from '../common/events';
import { atLeast } from '../common/utils/roles.util';
import { USER_BRIEF } from '../common/utils/selects';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { StorageService } from './storage.service';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
]);

/** multer decodes names as latin1; restore UTF-8, drop path/control characters, cap the length. */
const cleanName = (original: string): string => {
  const utf8 = Buffer.from(original, 'latin1').toString('utf8');
  const name = utf8.replace(/[\\/\u0000-\u001f\u007f]/g, '_').trim().slice(0, 200);
  return name || 'file';
};

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
  ) {}

  async list(workspaceId: string, projectId: string, taskId: string) {
    const rows = await this.prisma.attachment.findMany({
      where: this.scope(workspaceId, projectId, taskId),
      include: { uploadedBy: { select: USER_BRIEF } },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(rows.map((row) => this.view(row)));
  }

  async upload(
    workspaceId: string,
    projectId: string,
    taskId: string,
    user: AuthUser,
    role: WorkspaceRole,
    file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Send the file in a multipart field named "file"');
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      throw new UnsupportedMediaTypeException('Allowed types: images, PDF, text, CSV, JSON and ZIP');
    }
    const project = await this.projects.requireProject(workspaceId, projectId);
    await this.projects.assertCanWork(project, user, role);
    const task = await this.prisma.task.findFirst({ where: { id: taskId, projectId } });
    if (!task) throw new NotFoundException('Task not found');

    const storageKey = `workspaces/${workspaceId}/tasks/${taskId}/${randomUUID()}`;
    await this.storage.put(storageKey, file.buffer, file.mimetype);
    let row;
    try {
      row = await this.prisma.attachment.create({
        data: {
          taskId,
          uploadedById: user.id,
          fileName: cleanName(file.originalname),
          contentType: file.mimetype,
          sizeBytes: file.size,
          storageKey,
        },
        include: { uploadedBy: { select: USER_BRIEF } },
      });
    } catch (err) {
      await this.storage.delete(storageKey).catch(() => undefined); // do not leave an unreferenced file
      throw err;
    }
    await this.activity.log({
      workspaceId,
      projectId,
      actorId: user.id,
      action: 'attachment.added',
      entityType: 'task',
      entityId: taskId,
      metadata: { fileName: row.fileName },
    });
    return this.view(row);
  }

  async remove(
    workspaceId: string,
    projectId: string,
    taskId: string,
    attachmentId: string,
    user: AuthUser,
    role: WorkspaceRole,
  ) {
    const row = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, ...this.scope(workspaceId, projectId, taskId) },
    });
    if (!row) throw new NotFoundException('Attachment not found');
    if (row.uploadedById !== user.id && !atLeast(role, WorkspaceRole.PROJECT_MANAGER)) {
      throw new ForbiddenException('Only the uploader or a project manager can delete this file');
    }
    await this.prisma.attachment.delete({ where: { id: row.id } });
    await this.storage.delete(row.storageKey).catch((err: Error) =>
      this.logger.error(`Could not delete object ${row.storageKey}: ${err.message}`),
    );
    await this.activity.log({
      workspaceId,
      projectId,
      actorId: user.id,
      action: 'attachment.removed',
      entityType: 'task',
      entityId: taskId,
      metadata: { fileName: row.fileName },
    });
  }

  /** Task/project/workspace deletions cascade rows in the database; this removes the files. */
  @OnEvent(Events.FilesOrphaned)
  async onFilesOrphaned(e: FilesOrphanedEvent) {
    try {
      await this.storage.deleteMany(e.keys);
    } catch (err) {
      this.logger.error(`Could not delete ${e.keys.length} orphaned files: ${(err as Error).message}`);
    }
  }

  private scope(workspaceId: string, projectId: string, taskId: string) {
    return { taskId, task: { projectId, project: { workspaceId } } };
  }

  private async view(row: Attachment & { uploadedBy: unknown }) {
    const { storageKey, ...rest } = row;
    return { ...rest, downloadUrl: await this.storage.downloadUrl(storageKey, row.fileName) };
  }
}
