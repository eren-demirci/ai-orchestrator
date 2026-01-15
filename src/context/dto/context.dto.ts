import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Prisma } from '@prisma/client';

export class CreateDocumentDto {
  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  taskId?: string;

  @IsOptional()
  metadata?: Prisma.JsonValue;
}

export class SearchContextDto {
  @IsString()
  query: string;

  @IsString()
  @IsOptional()
  taskId?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(20)
  limit?: number;
}
