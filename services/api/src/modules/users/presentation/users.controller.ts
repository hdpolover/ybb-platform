import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CreateUserHandler } from '../application/commands/handlers/create-user.handler';
import { GetUserHandler } from '../application/queries/handlers/get-user.handler';
import { GetUsersHandler } from '../application/queries/handlers/get-users.handler';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { CreateUserCommand } from '../application/commands/create-user.command';
import { GetUserQuery } from '../application/queries/get-user.query';
import { GetUsersQuery } from '../application/queries/get-users.query';

@ApiTags('users')
@Controller('users')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard) // TODO: Implement auth guards
export class UsersController {
  constructor(
    private readonly createUserHandler: CreateUserHandler,
    private readonly getUserHandler: GetUserHandler,
    private readonly getUsersHandler: GetUsersHandler,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const command = new CreateUserCommand(
      dto.brandId,
      dto.email,
      dto.password,
    );

    return this.createUserHandler.execute(command);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(
    @Param('id') id: string,
    @Query('brandId') brandId: string,
  ): Promise<UserResponseDto> {
    const query = new GetUserQuery(id, brandId);
    return this.getUserHandler.execute(query);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users for a brand' })
  @ApiQuery({ name: 'brandId', required: true })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  async findAll(
    @Query('brandId') brandId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ): Promise<UserResponseDto[]> {
    const query = new GetUsersQuery(
      brandId,
      skip ? parseInt(skip, 10) : undefined,
      take ? parseInt(take, 10) : undefined,
    );
    return this.getUsersHandler.execute(query);
  }
}
