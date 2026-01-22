import { ApiProperty } from '@nestjs/swagger';

export class AuthProviderDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  isOAuth: boolean;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  buttonColor: string;
}
