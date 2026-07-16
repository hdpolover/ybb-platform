import { PartialType } from '@nestjs/swagger';
import { CreateAiBotConfigDto } from './create-ai-bot.dto';

export class UpdateAiBotConfigDto extends PartialType(CreateAiBotConfigDto) {}
