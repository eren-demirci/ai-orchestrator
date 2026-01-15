import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class CreateModelConfigDto {
  @IsString()
  modelName: string;

  @IsString()
  provider: string;

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

  @IsNumber()
  @IsOptional()
  @Min(0)
  estimatedVRAM?: number;

  @IsOptional()
  defaultParams?: any;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateModelConfigDto {
  @IsString()
  @IsOptional()
  provider?: string;

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

  @IsNumber()
  @IsOptional()
  @Min(0)
  estimatedVRAM?: number;

  @IsOptional()
  defaultParams?: any;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
