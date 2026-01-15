import { Module } from '@nestjs/common';
import { ComfyUIService } from './comfyui.service';
import { WorkflowService } from './workflow.service';

@Module({
  providers: [ComfyUIService, WorkflowService],
  exports: [ComfyUIService, WorkflowService],
})
export class ComfyUIModule {}
