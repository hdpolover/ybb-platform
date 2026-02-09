
import { ApiProperty } from '@nestjs/swagger';
import { AuthResponseDto } from './auth-response.dto';

export class AdminAuthResponseDto extends AuthResponseDto {
    @ApiProperty({
        description: 'Admin specific details',
        example: {
            id: 'uuid',
            fullName: 'Admin User',
            role: 'Super Admin',
            accessLevel: 1
        }
    })
    admin: {
        id: string;
        fullName: string;
        role: string;
        accessLevel: number;
        permissions: string[];
        programs: {
            programId: string;
            role: string;
        }[];
        brands: {
            brandId: string;
            role: string;
        }[];
    };
}
