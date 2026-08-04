import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Prisma, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

type SafeUser = Omit<User, 'passwordHash'>;

type RegisterUserInput = Omit<
  Prisma.UserCreateInput,
  'email' | 'phoneNumber'
> & {
  email?: string;
  phoneNumber?: string;
  firstName: string;
  lastName: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async createUser(data: RegisterUserInput): Promise<User> {
    if (!data.email && !data.phoneNumber) {
      throw new ConflictException(
        'Either email or phoneNumber must be provided',
      );
    }

    const whereClauses: Array<Record<string, string>> = [];
    if (data.email) {
      whereClauses.push({ email: data.email });
    }
    if (data.phoneNumber) {
      whereClauses.push({ phoneNumber: data.phoneNumber });
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: whereClauses,
      },
    });

    if (existingUser) {
      throw new ConflictException('Email or phoneNumber is already registered');
    }

    try {
      const createData = {
        email: data.email ?? '',
        passwordHash: data.passwordHash,
        role: data.role,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
      };

      return await this.prisma.user.create({
        data: createData,
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Email or phoneNumber is already registered',
        );
      }
      throw error;
    }
  }

  async login(
    email: string | undefined,
    phoneNumber: string | undefined,
    password: string,
  ): Promise<{ accessToken: string; user: SafeUser }> {
    const whereClauses: Array<Record<string, string>> = [];

    if (email) {
      whereClauses.push({ email });
    }
    if (phoneNumber) {
      whereClauses.push({ phoneNumber });
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: whereClauses,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { passwordHash, ...safeUser } = updatedUser;
    void passwordHash;
    const accessToken = this.jwt.sign({
      sub: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    });

    return { accessToken, user: safeUser };
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is { code: string; meta?: { target?: string[] } } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}
