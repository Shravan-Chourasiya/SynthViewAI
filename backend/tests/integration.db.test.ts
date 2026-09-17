/**
 * integration.db.test.ts — Part 2
 * Database layer integration tests.
 * Requires: Docker running, @testcontainers/postgresql installed.
 *
 * Each test runs against a real containerized Postgres.
 * Tables are truncated between tests — no cross-test data leakage.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { setup, teardown, resetDb, getContainers } from "./helpers/containers.js";
import { usersTable } from "../src/modules/auth/schemas/user.schema.js";
import { sessionsTable } from "../src/modules/auth/schemas/session.schema.js";
import { interviewsTable } from "../src/modules/interview/schemas/interview.schema.js";
import { randomUUID } from "crypto";

beforeAll(async () => {
  await setup();
}, 120_000);
afterAll(async () => {
  await teardown();
});
beforeEach(async () => {
  await resetDb();
});

// ── User repository ───────────────────────────────────────────────────────────

describe("users table", () => {
  const baseUser = () => ({
    email: `user-${randomUUID()}@example.com`,
    password: "$2b$12$hashedpassword",
    username: `user_${randomUUID().slice(0, 8)}`,
    isVerified: true,
  });

  it("creates and retrieves a user by email", async () => {
    const { db } = getContainers();
    const u = baseUser();
    await db.insert(usersTable).values(u);

    const [found] = await db.select().from(usersTable).where(eq(usersTable.email, u.email));
    expect(found).toBeDefined();
    expect(found.email).toBe(u.email);
    expect(found.username).toBe(u.username);
  });

  it("enforces unique email constraint", async () => {
    const { db } = getContainers();
    const u = baseUser();
    await db.insert(usersTable).values(u);

    await expect(
      db.insert(usersTable).values({ ...u, username: `other_${randomUUID().slice(0, 8)}` }),
    ).rejects.toThrow();
  });

  it("enforces unique username constraint", async () => {
    const { db } = getContainers();
    const u = baseUser();
    await db.insert(usersTable).values(u);

    await expect(
      db.insert(usersTable).values({ ...u, email: `other-${randomUUID()}@example.com` }),
    ).rejects.toThrow();
  });

  it("defaults accountStatus to 'active'", async () => {
    const { db } = getContainers();
    const u = baseUser();
    await db.insert(usersTable).values(u);

    const [found] = await db.select().from(usersTable).where(eq(usersTable.email, u.email));
    expect(found.accountStatus).toBe("active");
  });

  it("defaults isVerified to false when not specified", async () => {
    const { db } = getContainers();
    const u = { ...baseUser(), isVerified: undefined };
    await db
      .insert(usersTable)
      .values({ email: u.email, password: u.password, username: u.username });

    const [found] = await db.select().from(usersTable).where(eq(usersTable.email, u.email));
    expect(found.isVerified).toBe(false);
  });

  it("updates accountStatus correctly", async () => {
    const { db } = getContainers();
    const u = baseUser();
    await db.insert(usersTable).values(u);

    await db
      .update(usersTable)
      .set({ accountStatus: "disabled" })
      .where(eq(usersTable.email, u.email));

    const [found] = await db.select().from(usersTable).where(eq(usersTable.email, u.email));
    expect(found.accountStatus).toBe("disabled");
  });

  it("password hash is stored — not plain text", async () => {
    const { db } = getContainers();
    const plain = "Password1";
    const hash = await bcrypt.hash(plain, 1);
    const u = { ...baseUser(), password: hash };
    await db.insert(usersTable).values(u);

    const [found] = await db.select().from(usersTable).where(eq(usersTable.email, u.email));
    expect(found.password).not.toBe(plain);
    expect(found.password).toMatch(/^\$2b\$/);
    expect(await bcrypt.compare(plain, found.password)).toBe(true);
  });
});

// ── Sessions table ────────────────────────────────────────────────────────────

describe("sessions table", () => {
  async function createUser() {
    const { db } = getContainers();
    const u = {
      email: `user-${randomUUID()}@example.com`,
      password: "$2b$12$hash",
      username: `user_${randomUUID().slice(0, 8)}`,
      isVerified: true,
    };
    const [user] = await db.insert(usersTable).values(u).returning({ id: usersTable.id });
    return user!;
  }

  function baseSession(userId: string) {
    return {
      userId,
      tokenFamily: randomUUID(),
      refreshToken: "refresh-token-" + randomUUID(),
      accessToken: "access-token-" + randomUUID(),
      csrfToken: "csrf-token-" + randomUUID(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      deviceType: "desktop" as const,
      deviceId: randomUUID(),
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    };
  }

  it("creates a session linked to a user", async () => {
    const { db } = getContainers();
    const user = await createUser();
    const s = baseSession(user.id);
    const [session] = await db.insert(sessionsTable).values(s).returning({ id: sessionsTable.id });

    expect(session).toBeDefined();
    expect(session.id).toBeTruthy();
  });

  it("session correctly references its owning user", async () => {
    const { db } = getContainers();
    const user = await createUser();
    const s = baseSession(user.id);
    await db.insert(sessionsTable).values(s);

    const [found] = await db.select().from(sessionsTable).where(eq(sessionsTable.userId, user.id));
    expect(found.userId).toBe(user.id);
  });

  it("cascades delete when user is deleted", async () => {
    const { db } = getContainers();
    const user = await createUser();
    await db.insert(sessionsTable).values(baseSession(user.id));

    await db.delete(usersTable).where(eq(usersTable.id, user.id));

    const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.userId, user.id));
    expect(sessions).toHaveLength(0);
  });

  it("defaults isActive to true and isRevoked to false", async () => {
    const { db } = getContainers();
    const user = await createUser();
    await db.insert(sessionsTable).values(baseSession(user.id));

    const [found] = await db.select().from(sessionsTable).where(eq(sessionsTable.userId, user.id));
    expect(found.isActive).toBe(true);
    expect(found.isRevoked).toBe(false);
  });

  it("updates isActive and isRevoked on logout", async () => {
    const { db } = getContainers();
    const user = await createUser();
    const [session] = await db
      .insert(sessionsTable)
      .values(baseSession(user.id))
      .returning({ id: sessionsTable.id });

    await db
      .update(sessionsTable)
      .set({ isActive: false, isRevoked: true })
      .where(eq(sessionsTable.id, session!.id));

    const [found] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, session!.id));
    expect(found.isActive).toBe(false);
    expect(found.isRevoked).toBe(true);
  });
});

// ── Interviews table ──────────────────────────────────────────────────────────

describe("interviews table", () => {
  async function createUser() {
    const { db } = getContainers();
    const [user] = await db
      .insert(usersTable)
      .values({
        email: `user-${randomUUID()}@example.com`,
        password: "$2b$12$hash",
        username: `user_${randomUUID().slice(0, 8)}`,
        isVerified: true,
      })
      .returning({ id: usersTable.id });
    return user!;
  }

  it("creates an interview linked to a user", async () => {
    const { db } = getContainers();
    const user = await createUser();

    const [interview] = await db
      .insert(interviewsTable)
      .values({
        userId: user.id,
        interviewTitle: "SWE Interview",
        // interviewType / interviewCompanyStyle are NOT NULL without defaults.
        interviewType: "MIXED",
        interviewCompanyStyle: "REGULAR",
        interviewMetaData: { jobRole: "Engineer", interviewType: "MIXED" },
        interviewDuration: 30,
      })
      .returning({ id: interviewsTable.id, userId: interviewsTable.userId });

    expect(interview).toBeDefined();
    expect(interview.userId).toBe(user.id);
  });

  it("interview correctly references its owning user (FK queryable)", async () => {
    const { db } = getContainers();
    const user = await createUser();

    await db.insert(interviewsTable).values({
      userId: user.id,
      interviewTitle: "Test Interview",
      interviewType: "MIXED",
      interviewCompanyStyle: "REGULAR",
      interviewMetaData: {},
      interviewDuration: 45,
    });

    const [found] = await db
      .select()
      .from(interviewsTable)
      .where(eq(interviewsTable.userId, user.id));
    expect(found.userId).toBe(user.id);
  });

  it("defaults interviewStatus to READY", async () => {
    const { db } = getContainers();
    const user = await createUser();

    await db.insert(interviewsTable).values({
      userId: user.id,
      interviewTitle: "Draft Interview",
      interviewType: "MIXED",
      interviewCompanyStyle: "REGULAR",
      interviewMetaData: {},
      interviewDuration: 20,
    });

    const [found] = await db
      .select()
      .from(interviewsTable)
      .where(eq(interviewsTable.userId, user.id));
    // Schema default is READY (unscheduled interviews are startable immediately).
    expect(found.interviewStatus).toBe("READY");
  });

  it("cascades delete when user is deleted", async () => {
    const { db } = getContainers();
    const user = await createUser();

    await db.insert(interviewsTable).values({
      userId: user.id,
      interviewTitle: "To be deleted",
      interviewType: "MIXED",
      interviewCompanyStyle: "REGULAR",
      interviewMetaData: {},
      interviewDuration: 10,
    });

    await db.delete(usersTable).where(eq(usersTable.id, user.id));

    const interviews = await db
      .select()
      .from(interviewsTable)
      .where(eq(interviewsTable.userId, user.id));
    expect(interviews).toHaveLength(0);
  });

  it("two different users' interviews are isolated", async () => {
    const { db } = getContainers();
    const [u1, u2] = await Promise.all([createUser(), createUser()]);

    await db.insert(interviewsTable).values({
      userId: u1.id,
      interviewTitle: "U1 Interview",
      interviewType: "MIXED",
      interviewCompanyStyle: "REGULAR",
      interviewMetaData: {},
      interviewDuration: 30,
    });
    await db.insert(interviewsTable).values({
      userId: u2.id,
      interviewTitle: "U2 Interview",
      interviewType: "MIXED",
      interviewCompanyStyle: "REGULAR",
      interviewMetaData: {},
      interviewDuration: 30,
    });

    const u1Interviews = await db
      .select()
      .from(interviewsTable)
      .where(eq(interviewsTable.userId, u1.id));
    const u2Interviews = await db
      .select()
      .from(interviewsTable)
      .where(eq(interviewsTable.userId, u2.id));

    expect(u1Interviews).toHaveLength(1);
    expect(u2Interviews).toHaveLength(1);
    expect(u1Interviews[0]!.interviewTitle).toBe("U1 Interview");
    expect(u2Interviews[0]!.interviewTitle).toBe("U2 Interview");
  });
});
