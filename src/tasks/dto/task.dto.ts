import {
  IsString,
  IsArray,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  allowedModels: string[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  maxCost?: number;

  @IsBoolean()
  @IsOptional()
  requiresRAG?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tools?: string[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  maxTokens?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(2)
  minTemperature?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(2)
  maxTemperature?: number;
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedModels?: string[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  maxCost?: number;

  @IsBoolean()
  @IsOptional()
  requiresRAG?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tools?: string[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  maxTokens?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(2)
  minTemperature?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(2)
  maxTemperature?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
