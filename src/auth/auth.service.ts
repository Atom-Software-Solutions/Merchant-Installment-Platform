import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Prisma, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../utils/mail.service';

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
    private readonly mailService: MailService,
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

      const createdUser = await this.prisma.user.create({
        data: createData,
      });

      if (createdUser.email) {
        try {
          const token = this.createActivationToken(createdUser.id);
          await this.mailService.sendActivationEmail(createdUser.email, token);
        } catch (mailError) {
          throw new InternalServerErrorException(
            'User created, but activation email could not be sent.',
          );
        }
      }

      return createdUser;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Email or phoneNumber is already registered',
        );
      }
      throw error;
    }
  }

  async activateAccount(token: string): Promise<User> {
    const payload = this.verifyActivationToken(token);

    if (!payload?.sub) {
      throw new NotFoundException('Invalid activation token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: payload.sub },
      data: { isActive: true },
    });
  }

  async resendActivationEmail(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isActive) {
      throw new ConflictException('Account is already active');
    }

    const token = this.createActivationToken(user.id);
    await this.mailService.sendActivationEmail(user.email!, token);
  }

  async login(
    email: string | undefined,
    phoneNumber: string | undefined,
    password: string,
  ): Promise<{ accessToken: string; user: SafeUser; requiresActivation: boolean }> {
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

    if (!user) {
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
      isActive: updatedUser.isActive,
      scope: updatedUser.isActive ? 'auth' : 'resend-activation',
    });

    return {
      accessToken,
      user: safeUser,
      requiresActivation: !updatedUser.isActive,
    };
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  private createActivationToken(userId: string): string {
    return this.jwt.sign({ sub: userId, purpose: 'activate-account' }, { expiresIn: '1d' });
  }

  private verifyActivationToken(token: string): { sub?: string; purpose?: string } | null {
    if (!token) {
      return null;
    }

    try {
      const payload = this.jwt.verify(token);
      if (
        typeof payload === 'object' &&
        payload !== null &&
        payload.sub &&
        payload.purpose === 'activate-account'
      ) {
        return payload as { sub: string; purpose: string };
      }
    } catch {
      // ignore invalid or expired token
    }

    return null;
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
