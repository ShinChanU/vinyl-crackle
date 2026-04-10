export interface CrackleParams {
  surface: number;
  popsPerSec: number;
  dust: number;
}

export type PresetName = "lightDust" | "warmVinyl" | "wornRecord" | "antique";

export interface Settings {
  enabled: boolean;
  preset: PresetName;
  params: CrackleParams;
  masterIntensity: number;
}

export type MessageType =
  | "GET_SETTINGS"
  | "UPDATE_SETTINGS"
  | "TOGGLE_ENABLED"
  | "SETTINGS_CHANGED";

export interface Message {
  type: MessageType;
  payload?: Partial<Settings>;
}

export interface MessageResponse {
  success: boolean;
  settings?: Settings;
}
