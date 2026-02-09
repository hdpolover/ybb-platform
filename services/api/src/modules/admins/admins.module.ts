
import { Module } from '@nestjs/common';
import { AdminsController } from './presentation/admins.controller';
import { CreateAdminHandler } from './application/commands/handlers/create-admin.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

import { GetAdminsHandler } from './application/queries/handlers/get-admins.handler';
import { GetAdminHandler } from './application/queries/handlers/get-admin.handler';
import { UpdateAdminHandler } from './application/commands/handlers/update-admin.handler';
import { DeleteAdminHandler } from './application/commands/handlers/delete-admin.handler';

import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [AdminsController],
    providers: [
        CreateAdminHandler,
        GetAdminsHandler,
        GetAdminHandler,
        UpdateAdminHandler,
        DeleteAdminHandler,
    ],
})
export class AdminsModule { }
