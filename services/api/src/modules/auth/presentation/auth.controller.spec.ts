
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { LoginHandler } from '../application/commands/handlers/login.handler';
import { AdminLoginHandler } from '../application/commands/handlers/admin-login.handler';
import { AdminRefreshHandler } from '../application/commands/handlers/admin-refresh.handler';
import { AmbassadorLoginHandler } from '../application/commands/handlers/ambassador-login.handler';
import { RegisterHandler } from '../application/commands/handlers/register.handler';
import { RegisterAdminHandler } from '../application/commands/handlers/register-admin.handler';
import { LogoutHandler } from '../application/commands/handlers/logout.handler';
import { ForgotPasswordHandler } from '../application/commands/handlers/forgot-password.handler';
import { ResetPasswordHandler } from '../application/commands/handlers/reset-password.handler';
import { VerifyEmailHandler } from '../application/commands/handlers/verify-email.handler';
import { ResendVerificationEmailHandler } from '../application/commands/handlers/resend-verification-email.handler';
import { FirebaseLoginHandler } from '../application/commands/handlers/firebase-login.handler';
import { LinkLocalIdentityHandler } from '../application/commands/handlers/link-local-identity.handler';
import { GetUserProfileHandler } from '../application/queries/handlers/get-user-profile.handler';
import { GetAuthProvidersHandler } from '../application/queries/handlers/get-auth-providers.handler';
import { GetAuthContextHandler } from '../application/queries/handlers/get-auth-context.handler';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginCommand } from '../application/commands/login.command';
import { RegisterCommand } from '../application/commands/register.command';

import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';

describe('AuthController', () => {
    let controller: AuthController;
    let loginHandler: LoginHandler;
    let registerHandler: RegisterHandler;

    const mockLoginHandler = { execute: jest.fn() };
    const mockAdminLoginHandler = { execute: jest.fn() };
    const mockAdminRefreshHandler = { execute: jest.fn() };
    const mockAmbassadorLoginHandler = { execute: jest.fn() };
    const mockRegisterHandler = { execute: jest.fn() };
    const mockRegisterAdminHandler = { execute: jest.fn() };
    const mockLogoutHandler = { execute: jest.fn() };
    const mockForgotPasswordHandler = { execute: jest.fn() };
    const mockResetPasswordHandler = { execute: jest.fn() };
    const mockVerifyEmailHandler = { execute: jest.fn() };
    const mockResendVerificationHandler = { execute: jest.fn() };
    const mockFirebaseLoginHandler = { execute: jest.fn() };
    const mockLinkLocalIdentityHandler = { execute: jest.fn() };
    const mockGetUserProfileHandler = { execute: jest.fn() };
    const mockGetAuthProvidersHandler = { execute: jest.fn() };
    const mockGetAuthContextHandler = { execute: jest.fn() };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                { provide: LoginHandler, useValue: mockLoginHandler },
                { provide: AdminLoginHandler, useValue: mockAdminLoginHandler },
                { provide: AdminRefreshHandler, useValue: mockAdminRefreshHandler },
                { provide: AmbassadorLoginHandler, useValue: mockAmbassadorLoginHandler },
                { provide: RegisterHandler, useValue: mockRegisterHandler },
                { provide: RegisterAdminHandler, useValue: mockRegisterAdminHandler },
                { provide: LogoutHandler, useValue: mockLogoutHandler },
                { provide: ForgotPasswordHandler, useValue: mockForgotPasswordHandler },
                { provide: ResetPasswordHandler, useValue: mockResetPasswordHandler },
                { provide: VerifyEmailHandler, useValue: mockVerifyEmailHandler },
                { provide: ResendVerificationEmailHandler, useValue: mockResendVerificationHandler },
                { provide: FirebaseLoginHandler, useValue: mockFirebaseLoginHandler },
                { provide: LinkLocalIdentityHandler, useValue: mockLinkLocalIdentityHandler },
                { provide: GetUserProfileHandler, useValue: mockGetUserProfileHandler },
                { provide: GetAuthProvidersHandler, useValue: mockGetAuthProvidersHandler },
                { provide: GetAuthContextHandler, useValue: mockGetAuthContextHandler },
            ],
        })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .compile();

        controller = module.get<AuthController>(AuthController);
        loginHandler = module.get<LoginHandler>(LoginHandler);
        registerHandler = module.get<RegisterHandler>(RegisterHandler);

        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('login', () => {
        it('should call LoginHandler with correct parameters', async () => {
            const dto: LoginDto = {
                email: 'test@example.com',
                password: 'password',
                brandId: 'cat-1',
                programId: 'prog-1',
                programSlug: 'iys-2026',
            };
            const mockReq = { headers: { 'user-agent': 'Jest' } };
            const ip = '127.0.0.1';
            const brandDomain = 'ybb.co';

            await controller.login(dto, brandDomain, ip, mockReq as any);

            expect(mockLoginHandler.execute).toHaveBeenCalledWith(
                expect.any(LoginCommand),
                brandDomain
            );

            const command = mockLoginHandler.execute.mock.calls[0][0] as LoginCommand;
            expect(command.email).toBe(dto.email);
            expect(command.password).toBe(dto.password);
            expect(command.ipAddress).toBe(ip);
            expect(command.programId).toBe(dto.programId);
            expect(command.programSlug).toBe(dto.programSlug);
        });
    });

    describe('register', () => {
        it('should call RegisterHandler with Smart Registration params', async () => {
            const dto: RegisterDto = {
                email: 'new@example.com',
                password: 'pass',
                providerId: 'prov-1',
                brandId: 'cat-1',
                referralCode: 'REFCODE',
                programSlug: 'prog-slug'
            };
            const mockReq = { headers: { 'user-agent': 'Jest' } };
            const ip = '127.0.0.1';

            await controller.register(dto, undefined, ip, mockReq as any);

            expect(mockRegisterHandler.execute).toHaveBeenCalledWith(
                expect.any(RegisterCommand),
                undefined
            );

            const command = mockRegisterHandler.execute.mock.calls[0][0] as RegisterCommand;
            expect(command.email).toBe(dto.email);
            expect(command.referralCode).toBe('REFCODE');
            expect(command.programSlug).toBe('prog-slug');
        });
    });
});
