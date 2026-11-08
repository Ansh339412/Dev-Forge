import type { Notification, WorkspaceRole } from '@prisma/client';

/** Domain events. Notifications (next phase) subscribe to these; emitters stay unaware of them. */
export const Events = {
  TaskAssigned: 'task.assigned',
  TaskCommented: 'task.commented',
  ProjectUpdated: 'project.updated',
  TaskChanged: 'task.changed',
  InvitationCreated: 'invitation.created',
  NotificationCreated: 'notification.created',
  FilesOrphaned: 'files.orphaned',
} as const;

export interface TaskAssignedEvent {
  workspaceId: string;
  projectId: string;
  taskId: string;
  taskTitle: string;
  assigneeId: string;
  actorId: string;
}

export interface TaskCommentedEvent {
  workspaceId: string;
  projectId: string;
  taskId: string;
  taskTitle: string;
  actorId: string;
  recipientIds: string[];
}

export interface ProjectUpdatedEvent {
  workspaceId: string;
  projectId: string;
  actorId: string;
  changes: string[];
}

/** Rows are gone but their stored files still need deleting. */
export interface FilesOrphanedEvent {
  keys: string[];
}

export interface TaskChangedEvent {
  workspaceId: string;
  projectId: string;
  taskId: string;
  kind: 'created' | 'updated' | 'moved' | 'deleted';
  actorId: string;
}

export interface InvitationCreatedEvent {
  workspaceId: string;
  workspaceName: string;
  inviterId: string;
  inviterName: string;
  email: string;
  role: WorkspaceRole;
}

export interface NotificationCreatedEvent {
  userId: string;
  notification: Notification;
}
