import { ApiProperty } from '@nestjs/swagger';

export class SystemAnnouncementResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    content: string;

    @ApiProperty({ required: false })
    summary?: string;

    @ApiProperty()
    type: string;

    @ApiProperty()
    priority: string;

    @ApiProperty()
    publishedAt: Date;

    @ApiProperty()
    createdAt: Date;
}
