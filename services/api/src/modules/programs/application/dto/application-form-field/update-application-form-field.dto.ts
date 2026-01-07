import { PartialType } from '@nestjs/swagger';
import { CreateApplicationFormFieldDto } from './create-application-form-field.dto';

export class UpdateApplicationFormFieldDto extends PartialType(CreateApplicationFormFieldDto) {}
