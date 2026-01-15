import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsIn,
} from 'class-validator';

export type ImageSize = 'portrait' | 'square' | 'landscape';

export class ImageGenerationDto {
  @IsString()
  prompt: string;

  @IsString()
  @IsOptional()
  @IsIn(['portrait', 'square', 'landscape'])
  size?: ImageSize; // Image size preset: portrait, square, or landscape

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(1360)
  width?: number; // Image width (max 1360) - overrides size if provided

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(1360)
  height?: number; // Image height (max 1360) - overrides size if provided

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  task_id?: string; // Optional explicit task ID
}
