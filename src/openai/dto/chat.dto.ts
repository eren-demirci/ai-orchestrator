import {
  IsString,
  IsArray,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @IsString()
  role: string;

  @IsString()
  content: string;
}

export class ChatCompletionDto {
  @IsString()
  model: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  max_tokens?: number;

  @IsBoolean()
  @IsOptional()
  stream?: boolean;

  @IsString()
  @IsOptional()
  task_id?: string; // Optional explicit task ID
}
