import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';

let cachedApp: NestExpressApplication | undefined;

async function createApp() {
  if (!cachedApp) {
    const app = await NestFactory.create<NestExpressApplication>(
      AppModule,
      new ExpressAdapter(),
    );

    app.enableCors({
      origin: true,
      credentials: true,
    });

    await app.init();
    cachedApp = app;
  }

  return cachedApp;
}

export async function bootstrap() {
  const app = await createApp();
  await app.listen(process.env.PORT ?? 3000);
  return app;
}

export async function handler(req: Request, res: Response): Promise<unknown> {
  const app = await createApp();
  const expressApp = app.getHttpAdapter().getInstance() as (
    req: Request,
    res: Response,
  ) => unknown;
  return expressApp(req, res);
}

if (require.main === module) {
  void bootstrap();
}

export default handler;
