import { Injectable } from '@nestjs/common';
import { ComfyUIWorkflow } from './comfyui.service';

@Injectable()
export class WorkflowService {
  /**
   * Create SDXL workflow
   * ComfyUI workflow format: Each node has a unique ID and contains inputs and class_type
   * Output nodes must be properly connected
   */
  createSDXLWorkflow(prompt: string, negativePrompt?: string): ComfyUIWorkflow {
    // SDXL workflow with proper node connections
    // Using CheckpointLoaderSimple for simplicity (works with SDXL models)
    // Node IDs: 1=Checkpoint, 2=EmptyLatent, 3=CLIPTextEncode(positive), 4=CLIPTextEncode(negative), 5=KSampler, 6=VAEDecode, 7=SaveImage

    return {
      '1': {
        inputs: {
          ckpt_name: 'sd_xl_base_1.0.safetensors',
        },
        class_type: 'CheckpointLoaderSimple',
      },
      '2': {
        inputs: {
          width: 1024,
          height: 1024,
          batch_size: 1,
        },
        class_type: 'EmptyLatentImage',
      },
      '3': {
        inputs: {
          text: prompt,
          clip: ['1', 1], // Connect to CheckpointLoaderSimple's CLIP output
        },
        class_type: 'CLIPTextEncode',
      },
      '4': {
        inputs: {
          text: negativePrompt || 'blurry, low quality, distorted',
          clip: ['1', 1], // Connect to CheckpointLoaderSimple's CLIP output
        },
        class_type: 'CLIPTextEncode',
      },
      '5': {
        inputs: {
          seed: Math.floor(Math.random() * 1000000),
          steps: 20,
          cfg: 7,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 1,
          model: ['1', 0], // Connect to CheckpointLoaderSimple's MODEL output
          positive: ['3', 0], // Connect to positive CLIPTextEncode
          negative: ['4', 0], // Connect to negative CLIPTextEncode
          latent_image: ['2', 0], // Connect to EmptyLatentImage
        },
        class_type: 'KSampler',
      },
      '6': {
        inputs: {
          samples: ['5', 0], // Connect to KSampler output
          vae: ['1', 2], // Connect to CheckpointLoaderSimple's VAE output
        },
        class_type: 'VAEDecode',
      },
      '7': {
        inputs: {
          filename_prefix: 'ComfyUI',
          images: ['6', 0], // Connect to VAEDecode output
        },
        class_type: 'SaveImage',
      },
    };
  }

  /**
   * Create Flux workflow with prompt, width, height injection
   * Includes 2x upscaling with RealESRGAN model (max 2K output)
   */
  createFluxWorkflow(
    prompt: string,
    width: number = 1024,
    height: number = 1024,
  ): ComfyUIWorkflow {
    // Ensure max 1024 (2x upscale = max 2048px)
    width = Math.min(width, 1024);
    height = Math.min(height, 1024);

    // Flux workflow with upscaling based on the provided template
    return {
      '6': {
        inputs: {
          text: prompt,
          clip: ['39', 1],
        },
        class_type: 'CLIPTextEncode',
        _meta: {
          title: 'CLIP Text Encode (Positive Prompt)',
        },
      },
      '8': {
        inputs: {
          samples: ['31', 0],
          vae: ['39', 2],
        },
        class_type: 'VAEDecode',
        _meta: {
          title: 'VAE Kod Çözme',
        },
      },
      '9': {
        inputs: {
          filename_prefix: 'ComfyUI',
          images: ['41', 0], // Connect to upscaled image (node 41)
        },
        class_type: 'SaveImage',
        _meta: {
          title: 'Görüntüyü Kaydet',
        },
      },
      '27': {
        inputs: {
          width: width,
          height: height,
          batch_size: 1,
        },
        class_type: 'EmptySD3LatentImage',
        _meta: {
          title: 'BoşSD3GizliGörüntü',
        },
      },
      '31': {
        inputs: {
          seed: Math.floor(Math.random() * 1000000000000),
          steps: 20,
          cfg: 1,
          sampler_name: 'euler',
          scheduler: 'simple',
          denoise: 1,
          model: ['39', 0],
          positive: ['35', 0],
          negative: ['33', 0],
          latent_image: ['27', 0],
        },
        class_type: 'KSampler',
        _meta: {
          title: 'KSampler',
        },
      },
      '33': {
        inputs: {
          text: '',
          clip: ['39', 1],
        },
        class_type: 'CLIPTextEncode',
        _meta: {
          title: 'CLIP Text Encode (Negative Prompt)',
        },
      },
      '35': {
        inputs: {
          guidance: 3.5,
          conditioning: ['6', 0],
        },
        class_type: 'FluxGuidance',
        _meta: {
          title: 'FluxRehberliği',
        },
      },
      '39': {
        inputs: {
          ckpt_name: 'flux1-dev-fp8.safetensors',
          device: 'cuda:0',
        },
        class_type: 'CheckpointLoaderSimpleMultiGPU',
        _meta: {
          title: 'CheckpointLoaderSimpleMultiGPU',
        },
      },
      '41': {
        inputs: {
          upscale_model: ['43', 0], // Connect to UpscaleModelLoader
          image: ['8', 0], // Connect to VAEDecode output
        },
        class_type: 'ImageUpscaleWithModel',
        _meta: {
          title: 'Görüntüyü Büyüt (Model kullanarak)',
        },
      },
      '43': {
        inputs: {
          model_name: '2xLexicaRRDBNet.pth',
        },
        class_type: 'UpscaleModelLoader',
        _meta: {
          title: 'Büyütme Modeli Yükle',
        },
      },
    };
  }

  /**
   * Create Flux Krea Dev workflow with prompt, width, height injection
   * Based on flux1_krea_dev.json template
   */
  createFluxKreaWorkflow(
    prompt: string,
    width: number = 768,
    height: number = 1360,
  ): ComfyUIWorkflow {
    const seed = Math.floor(Math.random() * 1000000000000);
    const seedStr = String(seed);

    return {
      '9': {
        inputs: {
          filename_prefix: 'flux_krea',
          images: ['53:8', 0],
        },
        class_type: 'SaveImage',
        _meta: {
          title: 'Görüntüyü Kaydet',
        },
      },
      '53:27': {
        inputs: {
          width: width,
          height: height,
          batch_size: 1,
        },
        class_type: 'EmptySD3LatentImage',
        _meta: {
          title: 'BoşSD3GizliGörüntü',
        },
      },
      '53:31': {
        inputs: {
          seed: seedStr,
          steps: 20,
          cfg: 1,
          sampler_name: 'euler',
          scheduler: 'simple',
          denoise: 1,
          model: ['53:52', 0],
          positive: ['53:45', 0],
          negative: ['53:42', 0],
          latent_image: ['53:27', 0],
        },
        class_type: 'KSampler',
        _meta: {
          title: 'KSampler',
        },
      },
      '53:45': {
        inputs: {
          text: prompt,
          clip: ['53:53', 0],
        },
        class_type: 'CLIPTextEncode',
        _meta: {
          title: 'CLIP Metin Kodlama (İstem)',
        },
      },
      '53:8': {
        inputs: {
          samples: ['53:31', 0],
          vae: ['53:54', 0],
        },
        class_type: 'VAEDecode',
        _meta: {
          title: 'VAE Kod Çözme',
        },
      },
      '53:42': {
        inputs: {
          conditioning: ['53:45', 0],
        },
        class_type: 'ConditioningZeroOut',
        _meta: {
          title: 'KoşullandırmaSıfırla',
        },
      },
      '53:52': {
        inputs: {
          unet_name: 'flux1-krea-dev_fp8_scaled.safetensors',
          weight_dtype: 'default',
          device: 'cuda:1',
        },
        class_type: 'UNETLoaderMultiGPU',
        _meta: {
          title: 'UNETLoaderMultiGPU',
        },
      },
      '53:53': {
        inputs: {
          clip_name1: 'clip_l.safetensors',
          clip_name2: 't5xxl_fp8_e4m3fn.safetensors',
          type: 'flux',
          device: 'cuda:0',
        },
        class_type: 'DualCLIPLoaderMultiGPU',
        _meta: {
          title: 'DualCLIPLoaderMultiGPU',
        },
      },
      '53:54': {
        inputs: {
          vae_name: 'ae.safetensors',
          device: 'cuda:0',
        },
        class_type: 'VAELoaderMultiGPU',
        _meta: {
          title: 'VAELoaderMultiGPU',
        },
      },
    };
  }

  /**
   * Create custom workflow from template
   */
  createCustomWorkflow(
    template: string,
    params: Record<string, any>,
  ): ComfyUIWorkflow {
    // This would load a workflow template and inject parameters
    // For now, return a basic structure
    const prompt = String(params.prompt || '');
    const negativePrompt = params.negativePrompt
      ? String(params.negativePrompt)
      : undefined;
    return this.createSDXLWorkflow(prompt, negativePrompt);
  }
}
