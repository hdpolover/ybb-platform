import { Controller, Post, UseInterceptors, UploadedFile, Body, Get, Param, Res, Query, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileGrpcClient } from '../infrastructure/clients/file-grpc-client.service';
import { Response } from 'express';

@Controller('grpc-files')
export class GrpcFilesTestController {
  constructor(private readonly fileGrpcClient: FileGrpcClient) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('user_id') userId: string,
    @Body('brand_id') brandId: string,
    @Body('bucket') bucket: string = 'documents',
    @Body('program_id') programId?: string,
    @Body('participant_id') participantId?: string,
  ) {
    if (!file) throw new BadRequestException('File required');

    return await this.fileGrpcClient.uploadFile(file.buffer, {
      filename: file.originalname,
      content_type: file.mimetype,
      user_id: userId,
      brand_id: brandId,
      bucket: bucket,
      program_id: programId,
      participant_id: participantId
    });
  }

  @Get(':id')
  async getFile(
    @Param('id') fileId: string,
    @Query('user_id') userId: string,
    @Query('brand_id') brandId: string,
  ) {
    return await this.fileGrpcClient.getFile(fileId, userId, brandId);
  }

  @Get(':id/download')
  async downloadFile(
    @Param('id') fileId: string,
    @Query('user_id') userId: string,
    @Query('brand_id') brandId: string,
    @Res() res: Response
  ) {
    const fileMeta = await this.fileGrpcClient.getFile(fileId, userId, brandId);
    const buffer = await this.fileGrpcClient.downloadFile(fileId, userId, brandId);
    
    res.set({
      'Content-Type': fileMeta.content_type,
      'Content-Disposition': `attachment; filename="${fileMeta.original_filename}"`,
      'Content-Length': buffer.length
    });
    
    res.send(buffer);
  }
}
