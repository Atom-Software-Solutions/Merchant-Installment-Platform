/// <reference types="jest" />

import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

type FindUniqueMock = jest.MockedFunction<
  (args: { where: { email: string } }) => Promise<unknown>
>;
type UpdateMock = jest.MockedFunction<
  (args: {
    where: { id: string };
    data: { lastLoginAt: Date };
  }) => Promise<unknown>
>;
type SignMock = jest.MockedFunction<
  <T extends Record<string, unknown>>(payload: T, options?: unknown) => string
>;

jest.mock('argon2', () => ({
  verify: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: FindUniqueMock; update: UpdateMock } };
  let jwt: { sign: SignMock };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn<Promise<unknown>, [{ where: { email: string } }]>(),
        update: jest.fn<
          Promise<unknown>,
          [{ where: { id: string }; data: { lastLoginAt: Date } }]
        >(),
      },
    };
    jwt = {
      sign: jest.fn<
        string,
        [payload: Record<string, unknown>, options?: unknown]
      >(),
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

    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue({ ...user, lastLoginAt: new Date() });
    (argon2.verify as unknown as jest.Mock).mockResolvedValue(true);
    jwt.sign.mockReturnValue('token');

    const result = await service.login('a@test.com', 'secret');

    expect(result.accessToken).toBe('token');
    expect(result.user.email).toBe('a@test.com');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('throws for invalid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login('a@test.com', 'secret')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
