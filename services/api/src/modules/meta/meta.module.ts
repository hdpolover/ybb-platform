import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LandingModule } from '@modules/landing/landing.module';
import { MetaCapiController } from './meta-capi.controller';
import { MetaCapiService } from './meta-capi.service';

// Isolated module for the public Meta Conversions API relay. Deliberately does
// not touch PaymentsModule/payment flow — this only reads brand settings
// (pixel_id + capiAccessToken) via PrismaService and LandingService's existing
// host-resolution.
@Module({
    imports: [
        HttpModule.register({
            timeout: 5000, // Graph API calls must never hang the analytics relay
        }),
        LandingModule,
    ],
    controllers: [MetaCapiController],
    providers: [MetaCapiService],
})
export class MetaModule {}
