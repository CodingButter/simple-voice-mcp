/**
 * TTS Manager
 * Handles text-to-speech using ElevenLabs SDK
 */

import { ElevenLabsClient } from "elevenlabs";
import type { WebSocketManager } from "./websocket.js";

export interface TTSOptions {
  voiceId?: string;
  modelId?: string;
}

export class TTSManager {
  private client: ElevenLabsClient;
  private wsManager: WebSocketManager;
  private defaultVoiceId: string;
  private defaultModelId: string;

  constructor(wsManager: WebSocketManager, apiKey: string) {
    // TODO: Initialize ElevenLabs client
    this.client = new ElevenLabsClient({ apiKey });
    this.wsManager = wsManager;

    // Get defaults from env or use sensible defaults
    this.defaultVoiceId = process.env.ELEVEN_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel voice
    this.defaultModelId = process.env.ELEVEN_MODEL_ID || "eleven_flash_v2_5"; // Fast model

    console.error("[TTS] Initialized with voice:", this.defaultVoiceId, "model:", this.defaultModelId);
  }

  async streamAudio(text: string, options: TTSOptions = {}) {
    const voiceId = options.voiceId || this.defaultVoiceId;
    const modelId = options.modelId || this.defaultModelId;

    console.error("[TTS] Streaming audio, text length:", text.length);

    try {
      // Use ElevenLabs SDK to stream audio as MP3
      const audioStream = await this.client.textToSpeech.convertAsStream(voiceId, {
        text,
        model_id: modelId,
        output_format: "mp3_44100_128",
      });

      // Stream audio chunks to client via WebSocket
      for await (const chunk of audioStream) {
        const b64 = Buffer.from(chunk).toString("base64");

        this.wsManager.send({
          type: "audio",
          mime: "audio/mpeg",
          b64,
        });
      }

      console.error("[TTS] Finished streaming audio");
    } catch (error) {
      console.error("[TTS] Error streaming audio:", error);

      // Send error to client
      this.wsManager.send({
        type: "error",
        error: `TTS Error: ${error}`,
      });

      throw error;
    }
  }
}
