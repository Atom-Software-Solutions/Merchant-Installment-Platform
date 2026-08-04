import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

class RegisterDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsEnum(['MERCHANT', 'CUSTOMER', 'ADMIN'] as const)
  role?: 'MERCHANT' | 'CUSTOMER' | 'ADMIN';
}

class LoginDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    if (!body.email && !body.phoneNumber) {
      throw new BadRequestException(
        'Either email or phoneNumber must be provided',
      );
    }

    const passwordHash = await argon2.hash(body.password);

    return this.authService.createUser({
      email: body.email,
      passwordHash,
      firstName: body.firstName,
      lastName: body.lastName,
      phoneNumber: body.phoneNumber,
      role: body.role ?? 'CUSTOMER',
    });
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    if (!body.email && !body.phoneNumber) {
      throw new BadRequestException(
        'Either email or phoneNumber must be provided',
      );
    }

    return this.authService.login(body.email, body.phoneNumber, body.password);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('by-email')
  async getByEmail(@Query('email') email: string) {
    return this.authService.findUserByEmail(email);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me/:id')
  async getMe(@Param('id') id: string) {
    return this.authService.findUserById(id);
  }
}
