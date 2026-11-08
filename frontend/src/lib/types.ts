export type WorkspaceRole = 'WORKSPACE_ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER' | 'VIEWER';
export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';

export interface UserBrief {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}
export interface AuthUser extends UserBrief {
  systemRole: 'USER' | 'SUPER_ADMIN';
}
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: WorkspaceRole;
}
export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  deadline: string | null;
  manager: UserBrief;
  managerId: string;
  taskCounts: Record<TaskStatus, number>;
  completionPercent: number;
  _count: { members: number; tasks: number };
}
export interface Label {
  id: string;
  name: string;
  color: string;
}
export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  assignee: UserBrief | null;
  assigneeId: string | null;
  createdById: string;
  labels: Label[];
  position: number;
  updatedAt: string;
  _count: { comments: number };
}
export type Board = Record<TaskStatus, Task[]>;
export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: UserBrief;
}
export interface Attachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  downloadUrl: string;
  uploadedBy: UserBrief | null;
}
export interface Member {
  role: WorkspaceRole;
  joinedAt: string;
  user: UserBrief;
}
export interface Invitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
}
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  workspaceId: string | null;
  projectId: string | null;
  taskId: string | null;
  readAt: string | null;
  createdAt: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export interface Dashboard {
  totals: {
    totalProjects: number;
    activeProjects: number;
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
  };
  projectCompletion: { id: string; name: string; totalTasks: number; completedTasks: number; completionPercent: number }[];
  productivity: { windowDays: number; members: { user: UserBrief; completedInWindow: number; openTasks: number }[] };
  activity: { date: string; created: number; completed: number }[];
}

export interface Activity {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: UserBrief | null;
}
export interface GithubRepo {
  id: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
}
export interface Commit {
  sha: string;
  message: string;
  author: string | null;
  authorLogin: string | null;
  date: string | null;
  url: string;
}
export interface Profile extends UserBrief {
  emailNotifications: boolean;
  createdAt: string;
}
export interface SessionInfo {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}
