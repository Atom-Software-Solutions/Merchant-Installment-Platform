/// <reference types="jest" />

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController validation', () => {
  let app: INestApplication<App>;
  const authService = {
    createUser: jest.fn(),
    login: jest.fn(),
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
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

  it('rejects non-whitelisted fields on register', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'a@test.com',
        password: 'secret',
        firstName: 'Alice',
        lastName: 'Smith',
        role: 'CUSTOMER',
        extraField: true,
      });

    expect(response.status).toBe(400);
    expect(authService.createUser).not.toHaveBeenCalled();
  });

  it('rejects missing email and phoneNumber on register', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        password: 'secret',
        firstName: 'Alice',
        lastName: 'Smith',
      });

    expect(response.status).toBe(400);
    expect(authService.createUser).not.toHaveBeenCalled();
  });
});
