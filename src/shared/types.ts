export interface CrackleParams {
  surface: number;
  popsPerSec: number;
  dust: number;
}

export type PresetName = "lightDust" | "warmVinyl" | "wornRecord" | "antique";

export type PlaybackMode = "off" | "overlay" | "ambient";

export interface Settings {
  mode: PlaybackMode;
  preset: PresetName;
  params: CrackleParams;
  masterIntensity: number;
}

export type MessageType =
  | "GET_SETTINGS"
  | "UPDATE_SETTINGS"
  | "SET_MODE"
  | "SETTINGS_CHANGED";

export interface Message {
  type: MessageType;
  payload?: unknown;
}

export interface MessageResponse {
  success: boolean;
  settings?: Settings;
}
