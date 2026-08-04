/// <reference types="jest" />

import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

type SignMock = jest.Mock;

jest.mock('argon2', () => ({
  verify: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
  };
  let jwt: { sign: SignMock; verify: jest.Mock };
  let mailService: { sendActivationEmail: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    jwt = {
      sign: jest.fn(),
      verify: jest.fn(),
    };
    mailService = {
      sendActivationEmail: jest.fn(),
    };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      mailService as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs in a user with valid credentials', async () => {
    const user = {
      id: 'user-1',
      email: 'a@test.com',
      passwordHash: 'hash',
      role: 'CUSTOMER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    };

    prisma.user.findFirst.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue({ ...user, lastLoginAt: new Date() });
    (argon2.verify as unknown as jest.Mock).mockResolvedValue(true);
    jwt.sign.mockReturnValue('token');

    const result = await service.login('a@test.com', undefined, 'secret');

    expect(result.accessToken).toBe('token');
    expect(result.user.email).toBe('a@test.com');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.requiresActivation).toBe(false);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('sends an activation email after creating a user', async () => {
    const createdUser = {
      id: 'user-3',
      email: 'c@test.com',
      passwordHash: 'hash',
      role: 'CUSTOMER',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phoneNumber: null,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    };

    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(createdUser);
    mailService.sendActivationEmail.mockResolvedValue(undefined);
    jwt.sign.mockReturnValue('signed-token');

    const result = await service.createUser({
      email: 'c@test.com',
      passwordHash: 'hash',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'CUSTOMER',
    });

    expect(result).toEqual(createdUser);
    expect(mailService.sendActivationEmail).toHaveBeenCalledWith(
      createdUser.email,
      expect.any(String),
    );
  });

  it('activates a user from a valid activation token', async () => {
    const user = {
      id: 'user-4',
      email: 'd@test.com',
      passwordHash: 'hash',
      role: 'CUSTOMER',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    };

    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue({ ...user, isActive: true });
    jwt.verify.mockReturnValue({ sub: user.id, purpose: 'activate-account' });

    const activationToken = 'signed-token';
    const result = await service.activateAccount(activationToken);

    expect(result.isActive).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { isActive: true },
    });
  });

  it('allows inactive users to log in with a resend-activation token', async () => {
    const user = {
      id: 'user-2',
      email: 'b@test.com',
      passwordHash: 'hash',
      role: 'CUSTOMER',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    };

    prisma.user.findFirst.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue({ ...user, lastLoginAt: new Date() });
    (argon2.verify as unknown as jest.Mock).mockResolvedValue(true);
    jwt.sign.mockReturnValue('token');

    const result = await service.login('b@test.com', undefined, 'secret');

    expect(result.accessToken).toBe('token');
    expect(result.requiresActivation).toBe(true);
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: user.id,
        email: user.email,
        role: user.role,
        isActive: false,
        scope: 'resend-activation',
      }),
    );
  });

  it('throws for invalid credentials', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.login('a@test.com', undefined, 'secret'),
    ).rejects.toThrow(UnauthorizedException);
  });
});
