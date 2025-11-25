import { Module } from '@nestjs/common';
import { AuthController } from './presentation/auth.controller';

@Module({
  controllers: [AuthController],
  providers: [],
  exports: [],
})
export class AuthModule {}
