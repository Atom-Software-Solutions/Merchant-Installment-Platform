import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/utils/jwt.strategy';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/utils/mail.service';

type StoredUser = {
  id: string;
  email: string | null;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

type UserWhereClause = Record<string, string | null | undefined>;
type RegisterResponseBody = {
  id: string;
  email: string;
  isActive: boolean;
};
type LoginResponseBody = {
  requiresActivation: boolean;
  accessToken: string;
};
type ProtectedResponseBody = {
  email: string;
};

describe('Auth full flow (e2e)', () => {
  let app: INestApplication;
  let mailService: {
    sendActivationEmail: jest.Mock<Promise<void>, [string, string]>;
  };
  let prisma: {
    user: {
      findFirst: jest.Mock<
        Promise<StoredUser | null>,
        [{ where: { OR?: UserWhereClause[] } }]
      >;
      findUnique: jest.Mock<
        Promise<StoredUser | null>,
        [{ where: { id?: string; email?: string; phoneNumber?: string } }]
      >;
      create: jest.Mock<
        Promise<StoredUser>,
        [{ data: Record<string, unknown> }]
      >;
      update: jest.Mock<
        Promise<StoredUser | null>,
        [{ where: { id: string }; data: Record<string, unknown> }]
      >;
    };
  };
  const users: Record<string, StoredUser> = {};
  let nextId = 1;
  let lastActivationToken: string | null = null;

  beforeAll(async () => {
    mailService = {
      sendActivationEmail: jest.fn((_email: string, token: string) => {
        lastActivationToken = token;
        return Promise.resolve();
      }),
    };

    prisma = {
      user: {
        findFirst: jest.fn(
          ({ where: { OR } }: { where: { OR?: UserWhereClause[] } }) => {
            if (!OR) {
              return Promise.resolve(null);
            }
            for (const clause of OR) {
              if (clause.email) {
                const found = Object.values(users).find(
                  (user) => user.email === clause.email,
                );
                if (found) {
                  return Promise.resolve(found);
                }
              }
              if (clause.phoneNumber) {
                const found = Object.values(users).find(
                  (user) => user.phoneNumber === clause.phoneNumber,
                );
                if (found) {
                  return Promise.resolve(found);
                }
              }
            }
            return Promise.resolve(null);
          },
        ),
        findUnique: jest.fn(
          ({
            where,
          }: {
            where: { id?: string; email?: string; phoneNumber?: string };
          }) => {
            if (where.id) {
              return Promise.resolve(users[where.id] ?? null);
            }
            if (where.email) {
              return Promise.resolve(
                Object.values(users).find(
                  (user) => user.email === where.email,
                ) ?? null,
              );
            }
            if (where.phoneNumber) {
              return Promise.resolve(
                Object.values(users).find(
                  (user) => user.phoneNumber === where.phoneNumber,
                ) ?? null,
              );
            }
            return Promise.resolve(null);
          },
        ),
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          const id = `user-${nextId++}`;
          const storedUser: StoredUser = {
            id,
            email: (data.email as string | null | undefined) ?? null,
            passwordHash: data.passwordHash as string,
            firstName: data.firstName as string,
            lastName: data.lastName as string,
            phoneNumber:
              (data.phoneNumber as string | null | undefined) ?? null,
            role: (data.role as string | undefined) ?? 'CUSTOMER',
            isActive: (data.isActive as boolean | undefined) ?? false,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLoginAt: null,
          };
          users[id] = storedUser;
          return Promise.resolve({ ...storedUser });
        }),
        update: jest.fn(
          ({
            where: { id },
            data,
          }: {
            where: { id: string };
            data: Record<string, unknown>;
          }) => {
            const existing = users[id];
            if (!existing) {
              return Promise.resolve(null);
            }
            const updatedUser: StoredUser = {
              ...existing,
              ...(data as Partial<StoredUser>),
              updatedAt: new Date(),
            };
            users[id] = updatedUser;
            return Promise.resolve({ ...updatedUser });
          },
        ),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: 'dev-secret',
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    Object.keys(users).forEach((key) => {
      delete users[key];
    });
    nextId = 1;
    lastActivationToken = null;
    jest.clearAllMocks();
  });

  it('registers, activates, and unlocks protected access', async () => {
    const server = app.getHttpServer() as SupertestApp;
    const registerResponse = await request(server).post('/auth/register').send({
      email: 'test@example.com',
      password: 'StrongP@ssword1',
      firstName: 'Test',
      lastName: 'User',
      role: 'MERCHANT',
    });

    const registerBody = registerResponse.body as RegisterResponseBody;

    expect(registerResponse.status).toBe(201);
    expect(registerBody.email).toBe('test@example.com');
    expect(registerBody.isActive).toBe(false);
    expect(mailService.sendActivationEmail).toHaveBeenCalledTimes(1);
    expect(lastActivationToken).toBeTruthy();

    const loginBefore = await request(server).post('/auth/login').send({
      email: 'test@example.com',
      password: 'StrongP@ssword1',
    });

    const loginBeforeBody = loginBefore.body as LoginResponseBody;

    expect(loginBefore.status).toBe(201);
    expect(loginBeforeBody.requiresActivation).toBe(true);
    expect(loginBeforeBody.accessToken).toBeTruthy();

    const protectedBefore = await request(server)
      .get(`/auth/me/${registerBody.id}`)
      .set('Authorization', `Bearer ${loginBeforeBody.accessToken}`);

    expect(protectedBefore.status).toBe(401);

    const activationResponse = await request(server)
      .get('/auth/activate')
      .query({ token: lastActivationToken });

    expect(activationResponse.status).toBe(200);
    expect(activationResponse.text).toContain('Account activated');

    const loginAfter = await request(server).post('/auth/login').send({
      email: 'test@example.com',
      password: 'StrongP@ssword1',
    });

    const loginAfterBody = loginAfter.body as LoginResponseBody;

    expect(loginAfter.status).toBe(201);
    expect(loginAfterBody.requiresActivation).toBe(false);
    expect(loginAfterBody.accessToken).toBeTruthy();

    const protectedAfter = await request(server)
      .get(`/auth/me/${registerBody.id}`)
      .set('Authorization', `Bearer ${loginAfterBody.accessToken}`);
    const protectedAfterBody = protectedAfter.body as ProtectedResponseBody;

    expect(protectedAfter.status).toBe(200);
    expect(protectedAfterBody.email).toBe('test@example.com');
  });
});
