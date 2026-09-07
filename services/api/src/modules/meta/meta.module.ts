import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LandingModule } from '@modules/landing/landing.module';
import { MetaCapiController } from './meta-capi.controller';
import { MetaCapiService } from './meta-capi.service';
import { TikTokEventsService } from './tiktok-events.service';

// Isolated module for the public Meta Conversions API relay, which now also
// fans out to TikTok's Events API (see TikTokEventsService). Deliberately does
// not touch PaymentsModule/payment flow — this only reads brand settings
// (pixel_id + capiAccessToken / tiktokPixelId + tiktokAccessToken) via
// PrismaService and LandingService's existing host-resolution.
//
// @Global(): MetaCapiService.emitServerEvent() is now called from AuthModule
// (application-created) and PaymentsModule (payment-succeeded) for
// server-side conversion tracking. This module already imports LandingModule,
// which imports PlatformSettingsModule, which imports AuthModule — so a plain
// `imports: [MetaModule]` in AuthModule would close a cycle
// (AuthModule -> MetaModule -> LandingModule -> PlatformSettingsModule ->
// AuthModule). @Global() (same pattern as PaymentModule in this codebase)
// lets AuthModule/PaymentsModule inject MetaCapiService without adding an
// edge to their `imports` array, sidestepping the cycle entirely instead of
// juggling forwardRef() on both ends of it. MetaModule is registered once, in
// AppModule.
@Global()
@Module({
    imports: [
        HttpModule.register({
            timeout: 5000, // Graph/TikTok API calls must never hang the analytics relay
        }),
        LandingModule,
    ],
    controllers: [MetaCapiController],
    providers: [MetaCapiService, TikTokEventsService],
    exports: [MetaCapiService],
})
export class MetaModule {}
