import { IsNumber, IsString, IsEnum, IsOptional } from 'class-validator';

export class AllocateGPUResourceDto {
  @IsNumber()
  requiredVRAM: number;

  @IsEnum(['ollama', 'comfyui'])
  provider: 'ollama' | 'comfyui';

  @IsString()
  jobId: string;
}

export class ReleaseGPUResourceDto {
  @IsNumber()
  gpuId: number;

  @IsString()
  jobId: string;

  @IsNumber()
  @IsOptional()
  vramUsed?: number;
}
