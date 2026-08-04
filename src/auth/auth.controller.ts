import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsEnum(['MERCHANT', 'CUSTOMER', 'ADMIN'] as const)
  role?: 'MERCHANT' | 'CUSTOMER' | 'ADMIN';
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    const passwordHash = await argon2.hash(body.password);

    return this.authService.createUser({
      email: body.email,
      passwordHash,
      role: body.role ?? 'CUSTOMER',
    });
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Get('by-email')
  async getByEmail(@Query('email') email: string) {
    return this.authService.findUserByEmail(email);
  }

  @Get('me/:id')
  async getMe(@Param('id') id: string) {
    return this.authService.findUserById(id);
  }
}
