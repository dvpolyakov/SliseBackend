import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AnalyticsModule } from './analytics/analytics.module';
import { AppModule } from './app.module';
import * as Sentry from '@sentry/node';

const port = process.env.PORT;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const options = {
    "origin": "*",
    "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
    "preflightContinue": false,
    "optionsSuccessStatus": 204,
    "credentials":true
  };
  app.enableCors(options);
 /* app.enableCors(
    {
      origin: ['https://app.slise.xyz'],
      methods: ['POST', 'PUT', 'DELETE', 'GET'],
      allowedHeaders: ['Access-Control-Allow-Origin'],
    }
  );*/
  const config = new DocumentBuilder()
    .setTitle('Slice')
    .setDescription('Slice API description')
    .setVersion('1.0')
    .addTag('Slice')
    .build();

  Sentry.init({
    dsn: 'https://47c6436e80ea42fbbc338d3be8f64049@o1304332.ingest.sentry.io/6544715',
  });

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger/slice', app, document);

  console.log(`used port: ${port}`)
  await app.listen(port);
}
bootstrap();
