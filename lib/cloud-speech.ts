export const CLOUD_SPEECH_VOICES = [
  { id: "female", label: "英文女声", providerVoiceId: 0 },
  { id: "male", label: "英文男声", providerVoiceId: 1 }
] as const;

export type CloudSpeechVoiceId = (typeof CLOUD_SPEECH_VOICES)[number]["id"];

export function cloudSpeechVoice(value: string | null | undefined) {
  return CLOUD_SPEECH_VOICES.find((voice) => voice.id === value) ?? CLOUD_SPEECH_VOICES[0];
}
