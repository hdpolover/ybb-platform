import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Res,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { Public } from '@shared/decorators/public.decorator';
import { FileServiceClient } from '../infrastructure/clients/file-service.client';
import { FileGrpcClient } from '../infrastructure/clients/file-grpc-client.service';

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.\-]/g, '_');
}

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Documents Controller
 *
 * Handles document generation (certificates, reports, PDFs) and proxies to File Service.
 */
@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private readonly fileServiceClient: FileServiceClient,
    private readonly fileGrpcClient: FileGrpcClient
  ) {}

  @Post('export/participants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export participant report to Excel' })
  @ApiResponse({ status: 200, description: 'Excel file generated successfully' })
  async exportParticipantReport(
    @Body() dto: {
      program_name: string;
      participants: Array<{
        name: string;
        email: string;
        phone: string;
        status: string;
        registration_date: string;
      }>;
    },
    @Res() res: Response,
  ) {
    try {
      this.logger.log(`Generating participant report for: ${dto.program_name}`);
      const buffer = await this.fileServiceClient.generateParticipantReport(dto);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(`participants_${dto.program_name}`)}.xlsx"`);
      res.send(buffer);
    } catch (error: unknown) {
      const msg = errMsg(error);
      this.logger.error(`Failed to generate participant report: ${msg}`);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to generate participant report', error: msg });
    }
  }

  @Post('export/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export payment report to Excel' })
  @ApiResponse({ status: 200, description: 'Excel file generated successfully' })
  async exportPaymentReport(
    @Body() dto: {
      program_name: string;
      start_date: string;
      end_date: string;
      payments: Array<{
        date: string;
        participant_name: string;
        amount: number;
        payment_method: string;
        status: string;
        transaction_id: string;
        reference: string;
      }>;
    },
    @Res() res: Response,
  ) {
    try {
      this.logger.log(`Generating payment report for: ${dto.program_name}`);
      const buffer = await this.fileServiceClient.generatePaymentReport(dto);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(`payments_${dto.program_name}`)}.xlsx"`);
      res.send(buffer);
    } catch (error: unknown) {
      const msg = errMsg(error);
      this.logger.error(`Failed to generate payment report: ${msg}`);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to generate payment report', error: msg });
    }
  }

  @Post('export/custom')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export custom report to Excel' })
  @ApiResponse({ status: 200, description: 'Excel file generated successfully' })
  async exportCustomReport(
    @Body() dto: {
      title: string;
      headers: string[];
      data: Record<string, unknown>[];
      sheet_name?: string;
    },
    @Res() res: Response,
  ) {
    try {
      this.logger.log(`Generating custom report: ${dto.title}`);
      const buffer = await this.fileServiceClient.generateCustomReport(dto);
      const sheetName = safeFilename(dto.sheet_name || 'Report');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${sheetName}.xlsx"`);
      res.send(buffer);
    } catch (error: unknown) {
      const msg = errMsg(error);
      this.logger.error(`Failed to generate custom report: ${msg}`);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to generate custom report', error: msg });
    }
  }

  @Post('generate/receipt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate payment receipt PDF' })
  @ApiResponse({ status: 200, description: 'PDF generated successfully' })
  async generateReceipt(
    @Body() dto: {
      transaction_data: {
        receipt_number: string;
        transaction_id: string;
        date: string;
        payer_name: string;
        payer_email: string;
        payer_phone: string;
        description: string;
        amount: number;
        payment_method: string;
        status: string;
      };
    },
    @Res() res: Response,
  ) {
    try {
      this.logger.log(`Generating receipt: ${dto.transaction_data.receipt_number}`);
      const response = await this.fileGrpcClient.generateReceipt({
        ...dto.transaction_data,
        currency: 'IDR',
        additional_data: {
          email: dto.transaction_data.payer_email,
          phone: dto.transaction_data.payer_phone,
          description: dto.transaction_data.description,
        },
      });
      res.setHeader('Content-Type', response.content_type);
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(response.filename)}"`);
      res.send(response.file_data);
    } catch (error: unknown) {
      const msg = errMsg(error);
      this.logger.error(`Failed to generate receipt: ${msg}`);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to generate receipt', error: msg });
    }
  }

  @Post('generate/offer-letter')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate offer letter PDF' })
  @ApiResponse({ status: 200, description: 'PDF generated successfully' })
  async generateOfferLetter(
    @Body() dto: {
      participant_data: {
        name: string;
        email: string;
        address?: string;
        city?: string;
      };
      program_data: {
        name: string;
        start_date?: string;
        duration?: string;
        location?: string;
        confirmation_deadline?: string;
      };
    },
    @Res() res: Response,
  ) {
    try {
      this.logger.log(`Generating offer letter for: ${dto.participant_data.name}`);
      const buffer = await this.fileServiceClient.generateOfferLetter(dto.participant_data, dto.program_data);
      const participantName = safeFilename(dto.participant_data.name);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="offer_letter_${participantName}.pdf"`);
      res.send(buffer);
    } catch (error: unknown) {
      const msg = errMsg(error);
      this.logger.error(`Failed to generate offer letter: ${msg}`);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to generate offer letter', error: msg });
    }
  }

  @Post('generate/certificate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate certificate (completion or participation)' })
  @ApiResponse({ status: 200, description: 'Certificate generated successfully' })
  async generateCertificate(
    @Body() dto: {
      participant_data: {
        name: string;
        email: string;
        metadata?: Record<string, unknown>;
      };
      program_data: {
        name: string;
        completion_date?: string;
        metadata?: Record<string, unknown>;
      };
      certificate_type?: string;
      template_path?: string;
    },
    @Res() res: Response,
  ) {
    try {
      const certificateType = dto.certificate_type || 'completion';
      this.logger.log(`Generating ${certificateType} certificate for: ${dto.participant_data.name}`);

      const combinedMetadata: Record<string, string> = {};
      if (dto.participant_data.metadata) {
        Object.entries(dto.participant_data.metadata).forEach(([k, v]) => { combinedMetadata[k] = String(v); });
      }
      if (dto.program_data.metadata) {
        Object.entries(dto.program_data.metadata).forEach(([k, v]) => { combinedMetadata[`program_${k}`] = String(v); });
      }
      if (dto.template_path) {
        // TODO(security): validate template_path against an allowlist before forwarding to the file service
        combinedMetadata['template_path'] = dto.template_path;
      }

      const response = await this.fileGrpcClient.generateCertificate({
        participant_name: dto.participant_data.name,
        program_name: dto.program_data.name,
        issued_at: dto.program_data.completion_date || new Date().toISOString(),
        template_type: certificateType,
        metadata: combinedMetadata,
      });

      res.setHeader('Content-Type', response.content_type);
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(response.filename)}"`);
      res.send(response.file_data);
    } catch (error: unknown) {
      const msg = errMsg(error);
      this.logger.error(`Failed to generate certificate: ${msg}`);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to generate certificate', error: msg });
    }
  }

  @Get('verify/:hash')
  @Public()
  @ApiOperation({ summary: 'Verify certificate authenticity' })
  @ApiResponse({ status: 200, description: 'Certificate verification result' })
  async verifyCertificate(@Param('hash') hash: string) {
    try {
      this.logger.log(`Verifying certificate: ${hash}`);
      return await this.fileServiceClient.verifyCertificate(hash);
    } catch (error: unknown) {
      const msg = errMsg(error);
      this.logger.error(`Failed to verify certificate: ${msg}`);
      return { success: false, message: 'Certificate verification failed', error: msg };
    }
  }
}
