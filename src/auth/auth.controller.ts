import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

class RegisterDto {
  email!: string;
  password!: string;
  role?: 'MERCHANT' | 'CUSTOMER' | 'ADMIN';
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

  @Get('me/:id')
  async getMe(@Param('id') id: string) {
    return this.authService.findUserById(id);
  }
}
