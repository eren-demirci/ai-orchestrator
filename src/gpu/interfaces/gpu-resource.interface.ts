export interface GPUResource {
  id: number; // GPU ID (0, 1) - slot/index
  name?: string; // GPU model name (e.g., "NVIDIA GeForce RTX 4090")
  slot?: number; // PCIe slot number (same as id usually)
  totalVRAM: number; // GB cinsinden (16, 8)
  usedVRAM: number; // GB cinsinden
  availableVRAM: number; // GB cinsinden
  provider: string | null; // "ollama" | "comfyui" | null
  jobId: string | null; // Aktif job ID
}

export interface JobResourceRequest {
  requiredVRAM: number; // GB cinsinden
  provider: 'ollama' | 'comfyui';
  jobId: string;
}

export interface GPUAllocation {
  gpuId: number;
  allocatedVRAM: number;
  provider: 'ollama' | 'comfyui';
  jobId: string;
}
