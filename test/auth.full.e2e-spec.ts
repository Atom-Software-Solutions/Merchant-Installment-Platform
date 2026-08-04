import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/utils/jwt.strategy';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/utils/mail.service';

describe('Auth full flow (e2e)', () => {
  let app: INestApplication;
  let mailService: { sendActivationEmail: jest.Mock<Promise<void>, [string, string]> };
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  const users: Record<string, any> = {};
  let nextId = 1;
  let lastActivationToken: string | null = null;

  beforeAll(async () => {
    mailService = {
      sendActivationEmail: jest.fn(async (_email: string, token: string) => {
        lastActivationToken = token;
      }),
    };

    prisma = {
      user: {
        findFirst: jest.fn(async ({ where: { OR } }) => {
          if (!Array.isArray(OR)) {
            return null;
          }
          for (const clause of OR) {
            if ('email' in clause && clause.email) {
              const found = Object.values(users).find(
                (user) => user.email === clause.email,
              );
              if (found) {
                return found;
              }
            }
            if ('phoneNumber' in clause && clause.phoneNumber) {
              const found = Object.values(users).find(
                (user) => user.phoneNumber === clause.phoneNumber,
              );
              if (found) {
                return found;
              }
            }
          }
          return null;
        }),
        findUnique: jest.fn(async ({ where }) => {
          if ('id' in where) {
            return users[where.id] ?? null;
          }
          if ('email' in where) {
            return (
              Object.values(users).find((user) => user.email === where.email) ??
              null
            );
          }
          if ('phoneNumber' in where) {
            return (
              Object.values(users).find(
                (user) => user.phoneNumber === where.phoneNumber,
              ) ?? null
            );
          }
          return null;
        }),
        create: jest.fn(async ({ data }) => {
          const id = `user-${nextId++}`;
          const storedUser = {
            id,
            email: data.email,
            passwordHash: data.passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
            phoneNumber: data.phoneNumber ?? null,
            role: data.role ?? 'CUSTOMER',
            isActive: data.isActive ?? false,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLoginAt: null,
          };
          users[id] = storedUser;
          return { ...storedUser };
        }),
        update: jest.fn(async ({ where: { id }, data }) => {
          const existing = users[id];
          if (!existing) {
            return null;
          }
          const updatedUser = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          users[id] = updatedUser;
          return { ...updatedUser };
        }),
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
    Object.keys(users).forEach((key) => delete users[key]);
    nextId = 1;
    lastActivationToken = null;
    jest.clearAllMocks();
  });

  it('registers, activates, and unlocks protected access', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'StrongP@ssword1',
        firstName: 'Test',
        lastName: 'User',
        role: 'MERCHANT',
      });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.email).toBe('test@example.com');
    expect(registerResponse.body.isActive).toBe(false);
    expect(mailService.sendActivationEmail).toHaveBeenCalledTimes(1);
    expect(lastActivationToken).toBeTruthy();

    const loginBefore = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'StrongP@ssword1',
      });

    expect(loginBefore.status).toBe(201);
    expect(loginBefore.body.requiresActivation).toBe(true);
    expect(loginBefore.body.accessToken).toBeTruthy();

    const protectedBefore = await request(app.getHttpServer())
      .get(`/auth/me/${registerResponse.body.id}`)
      .set('Authorization', `Bearer ${loginBefore.body.accessToken}`);

    expect(protectedBefore.status).toBe(401);

    const activationResponse = await request(app.getHttpServer())
      .get('/auth/activate')
      .query({ token: lastActivationToken });

    expect(activationResponse.status).toBe(200);
    expect(activationResponse.text).toContain('Account activated');

    const loginAfter = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'StrongP@ssword1',
      });

    expect(loginAfter.status).toBe(201);
    expect(loginAfter.body.requiresActivation).toBe(false);
    expect(loginAfter.body.accessToken).toBeTruthy();

    const protectedAfter = await request(app.getHttpServer())
      .get(`/auth/me/${registerResponse.body.id}`)
      .set('Authorization', `Bearer ${loginAfter.body.accessToken}`);

    expect(protectedAfter.status).toBe(200);
    expect(protectedAfter.body.email).toBe('test@example.com');
  });
});
