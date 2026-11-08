import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { MailService } from '../src/mail/mail.service';

const API = '/api/v1';
const run = Date.now().toString(36);
const PASSWORD = 'a-long-test-passphrase';
const outbox: { to: string; subject: string; text: string }[] = [];

/** Pulls the single-use token out of the latest matching email. */
function tokenFrom(to: string, linkPart: string): string {
  const mail = [...outbox].reverse().find((m) => m.to === to && m.text.includes(linkPart));
  const match = mail?.text.match(/token=([a-f0-9]+)/);
  if (!match) throw new Error(`No "${linkPart}" email for ${to}`);
  return match[1];
}

describe('DevForge API (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({ send: async (to: string, subject: string, text: string) => void outbox.push({ to, subject, text }) })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function signUp(name: string) {
    const email = `${name}-${run}@example.test`;
    await http().post(`${API}/auth/register`).send({ email, password: PASSWORD, name }).expect(201);
    return email;
  }
  async function verifyAndLogin(email: string) {
    await http().post(`${API}/auth/verify-email`).send({ token: tokenFrom(email, 'verify-email') }).expect(200);
    const res = await http().post(`${API}/auth/login`).send({ email, password: PASSWORD }).expect(200);
    return { access: res.body.accessToken as string, refresh: res.body.refreshToken as string, id: res.body.user.id as string };
  }

  let alice: { access: string; refresh: string; id: string };
  let bob: { access: string; refresh: string; id: string };
  let aliceEmail: string;
  let bobEmail: string;
  let workspaceId: string;
  let projectId: string;
  const taskIds: string[] = [];

  it('rejects unauthenticated requests', async () => {
    await http().get(`${API}/workspaces`).expect(401);
  });

  it('blocks login until the email is verified, and verification tokens work once', async () => {
    aliceEmail = await signUp('alice');
    await http().post(`${API}/auth/login`).send({ email: aliceEmail, password: PASSWORD }).expect(403);
    const token = tokenFrom(aliceEmail, 'verify-email');
    await http().post(`${API}/auth/verify-email`).send({ token }).expect(200);
    await http().post(`${API}/auth/verify-email`).send({ token }).expect(400);
    const res = await http().post(`${API}/auth/login`).send({ email: aliceEmail, password: PASSWORD }).expect(200);
    alice = { access: res.body.accessToken, refresh: res.body.refreshToken, id: res.body.user.id };
  });

  it('rejects wrong passwords with a generic error', async () => {
    await http().post(`${API}/auth/login`).send({ email: aliceEmail, password: 'wrong-password-123' }).expect(401);
  });

  it('lets a user create a workspace, project and tasks, and tracks completion', async () => {
    const ws = await http().post(`${API}/workspaces`).set(auth(alice.access)).send({ name: 'Acme Engineering' }).expect(201);
    workspaceId = ws.body.id;

    const project = await http()
      .post(`${API}/workspaces/${workspaceId}/projects`)
      .set(auth(alice.access))
      .send({ name: 'Launch', priority: 'HIGH' })
      .expect(201);
    projectId = project.body.id;
    const base = `${API}/workspaces/${workspaceId}/projects/${projectId}`;

    for (const title of ['Write spec', 'Build it']) {
      const task = await http().post(`${base}/tasks`).set(auth(alice.access)).send({ title, status: 'TODO' }).expect(201);
      taskIds.push(task.body.id);
    }

    const board = await http().get(`${base}/tasks/board`).set(auth(alice.access)).expect(200);
    expect(board.body.TODO.map((t: { id: string }) => t.id)).toEqual(taskIds);

    // drop the second task above the first in the same column
    await http().post(`${base}/tasks/${taskIds[1]}/move`).set(auth(alice.access)).send({ status: 'TODO', afterTaskId: null }).expect(200);
    const reordered = await http().get(`${base}/tasks/board`).set(auth(alice.access)).expect(200);
    expect(reordered.body.TODO.map((t: { id: string }) => t.id)).toEqual([taskIds[1], taskIds[0]]);

    await http().post(`${base}/tasks/${taskIds[0]}/move`).set(auth(alice.access)).send({ status: 'COMPLETED' }).expect(200);
    const after = await http().get(base).set(auth(alice.access)).expect(200);
    expect(after.body.completionPercent).toBe(50);

    const dash = await http().get(`${API}/workspaces/${workspaceId}/analytics/dashboard`).set(auth(alice.access)).expect(200);
    expect(dash.body.totals).toMatchObject({ totalProjects: 1, completedTasks: 1, pendingTasks: 1 });
  });

  it('hides workspaces from non-members', async () => {
    bobEmail = await signUp('bob');
    bob = await verifyAndLogin(bobEmail);
    await http().get(`${API}/workspaces/${workspaceId}`).set(auth(bob.access)).expect(404);
  });

  it('enforces roles on the backend after an invitation is accepted', async () => {
    const invite = await http()
      .post(`${API}/workspaces/${workspaceId}/invitations`)
      .set(auth(alice.access))
      .send({ email: bobEmail, role: 'VIEWER' })
      .expect(201);
    expect(invite.body).not.toHaveProperty('tokenHash');

    await http()
      .post(`${API}/invitations/accept`)
      .set(auth(bob.access))
      .send({ token: tokenFrom(bobEmail, 'invitations/accept') })
      .expect(200);

    await http().get(`${API}/workspaces/${workspaceId}`).set(auth(bob.access)).expect(200);
    await http().get(`${API}/workspaces/${workspaceId}/projects/${projectId}/tasks/board`).set(auth(bob.access)).expect(200);
    await http().post(`${API}/workspaces/${workspaceId}/projects`).set(auth(bob.access)).send({ name: 'Nope' }).expect(403);
    await http()
      .post(`${API}/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set(auth(bob.access))
      .send({ title: 'Not allowed' })
      .expect(403);
    await http().post(`${API}/workspaces/${workspaceId}/invitations`).set(auth(bob.access)).send({ email: 'x@example.test', role: 'VIEWER' }).expect(403);
  });

  it('only lets the invited email accept an invitation', async () => {
    const carolEmail = await signUp('carol');
    const carol = await verifyAndLogin(carolEmail);
    const daveEmail = `dave-${run}@example.test`;
    await http().post(`${API}/workspaces/${workspaceId}/invitations`).set(auth(alice.access)).send({ email: daveEmail, role: 'DEVELOPER' }).expect(201);
    await http()
      .post(`${API}/invitations/accept`)
      .set(auth(carol.access))
      .send({ token: tokenFrom(daveEmail, 'invitations/accept') })
      .expect(403);
  });

  it('never leaves a workspace without an admin', async () => {
    await http().delete(`${API}/workspaces/${workspaceId}/members/me`).set(auth(alice.access)).expect(400);
  });

  it('rotates refresh tokens and revokes everything when one is replayed', async () => {
    const first = await http().post(`${API}/auth/refresh`).send({ refreshToken: alice.refresh }).expect(200);
    const second = first.body.refreshToken as string;
    expect(second).not.toEqual(alice.refresh);

    await http().post(`${API}/auth/refresh`).send({ refreshToken: alice.refresh }).expect(401); // replay
    await http().post(`${API}/auth/refresh`).send({ refreshToken: second }).expect(401); // family revoked
  });

  it('serves liveness and readiness probes', async () => {
    await http().get('/health/live').expect(200);
    await http().get('/health/ready').expect(200);
  });
});
