import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { UsersController } from './presentation/users.controller';
import { CreateUserHandler } from './application/commands/handlers/create-user.handler';
import { GetUserHandler } from './application/queries/handlers/get-user.handler';
import { GetUsersHandler } from './application/queries/handlers/get-users.handler';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { IUserRepository } from '@core/interfaces/repositories/user.repository.interface';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UsersController],
  providers: [
    // Handlers
    CreateUserHandler,
    GetUserHandler,
    GetUsersHandler,

    // Repositories
    {
      provide: IUserRepository,
      useClass: UserRepository,
    },
  ],
  exports: [IUserRepository],
})
export class UsersModule { }
