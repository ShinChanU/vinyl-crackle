interface AudioParamDescriptor {
  name: string;
  defaultValue?: number;
  minValue?: number;
  maxValue?: number;
  automationRate?: "a-rate" | "k-rate";
}

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  static get parameterDescriptors(): AudioParamDescriptor[];
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor
): void;

declare const currentFrame: number;
declare const currentTime: number;
declare const sampleRate: number;
