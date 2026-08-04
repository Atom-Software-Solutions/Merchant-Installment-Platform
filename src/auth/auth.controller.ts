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
      role: body.role ?? 'MERCHANT',
    });
  }

  @Get('activate')
  async activate(@Query('token') token: string) {
    try {
      await this.authService.activateAccount(token);
      return `
        <html>
          <head>
            <title>Account Activated</title>
            <style>
              body { font-family: Arial, sans-serif; background: #f9fafb; color: #111827; margin: 0; padding: 24px; }
              .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 20px 30px rgba(15, 23, 42, 0.08); padding: 32px; }
              h1 { margin-top: 0; color: #111827; }
              p { color: #4b5563; line-height: 1.7; }
              .button { display: inline-block; margin-top: 24px; background: #2563eb; color: white; padding: 14px 24px; border-radius: 10px; text-decoration: none; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Account activated</h1>
              <p>Your account has been successfully activated. You can now return to the app and sign in.</p>
              <a class="button" href="${process.env.APP_URL ?? 'http://localhost:3000'}">Go to App</a>
            </div>
          </body>
        </html>
      `;
    } catch (error) {
      return `
        <html>
          <head>
            <title>Activation Error</title>
            <style>
              body { font-family: Arial, sans-serif; background: #f9fafb; color: #111827; margin: 0; padding: 24px; }
              .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 20px 30px rgba(15, 23, 42, 0.08); padding: 32px; }
              h1 { margin-top: 0; color: #b91c1c; }
              p { color: #4b5563; line-height: 1.7; }
              .button { display: inline-block; margin-top: 24px; background: #2563eb; color: white; padding: 14px 24px; border-radius: 10px; text-decoration: none; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Unable to activate account</h1>
              <p>There was a problem activating your account. Please request a new activation email or try again later.</p>
              <a class="button" href="${process.env.APP_URL ?? 'http://localhost:3000'}">Return to App</a>
            </div>
          </body>
        </html>
      `;
    }
  }

  @Post('resend-activation')
  async resendActivation(@Body('email') email: string) {
    await this.authService.resendActivationEmail(email);
    return { message: 'Activation email resent' };
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
