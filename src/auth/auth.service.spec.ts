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
    user: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };
  let jwt: { sign: SignMock };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    jwt = {
      sign: jest.fn(),
    };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
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
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('throws for invalid credentials', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.login('a@test.com', undefined, 'secret'),
    ).rejects.toThrow(UnauthorizedException);
  });
});
