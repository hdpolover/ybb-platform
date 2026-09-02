
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminsController } from './presentation/admins.controller';
import { AdminRolesController } from './presentation/admin-roles.controller';
import { SupportAccessController } from './presentation/support-access.controller';
import { CreateAdminHandler } from './application/commands/handlers/create-admin.handler';

import { GetAdminsHandler } from './application/queries/handlers/get-admins.handler';
import { GetAdminHandler } from './application/queries/handlers/get-admin.handler';
import { UpdateAdminHandler } from './application/commands/handlers/update-admin.handler';
import { DeleteAdminHandler } from './application/commands/handlers/delete-admin.handler';
import { SupportAccessService } from './application/services/support-access.service';
import { AdminAccessControlService } from './application/services/admin-access-control.service';

import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        AuthModule,
        ConfigModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: {
                    expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h'),
                },
            }),
        }),
    ],
    controllers: [AdminsController, AdminRolesController, SupportAccessController],
    providers: [
        CreateAdminHandler,
        GetAdminsHandler,
        GetAdminHandler,
        UpdateAdminHandler,
        DeleteAdminHandler,
        SupportAccessService,
        AdminAccessControlService,
    ],
    exports: [AdminAccessControlService],
})
export class AdminsModule { }
