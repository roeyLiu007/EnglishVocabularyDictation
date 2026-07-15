import { createHash } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CloudSpeechVoiceId } from "@/lib/cloud-speech";
import { cloudSpeechVoice } from "@/lib/cloud-speech";

const defaultBucket = "tts-audio";

declare global {
  // eslint-disable-next-line no-var
  var __dictationTtsBucketReady: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __dictationBaiduToken: { value: string; expiresAt: number } | undefined;
  // eslint-disable-next-line no-var
  var __dictationBaiduTokenRequest: Promise<string> | undefined;
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少 ${name} 环境变量`);
  return value;
}

function supabaseAdmin() {
  const url = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const key = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function bucketName() {
  return process.env.SUPABASE_TTS_BUCKET?.trim() || defaultBucket;
}

async function ensureBucket(client: SupabaseClient) {
  if (!globalThis.__dictationTtsBucketReady) {
    globalThis.__dictationTtsBucketReady = (async () => {
      const name = bucketName();
      const { data } = await client.storage.getBucket(name);
      if (data) {
        if (!data.public) {
          const { error } = await client.storage.updateBucket(name, { public: true });
          if (error) throw error;
        }
        return;
      }

      const { error } = await client.storage.createBucket(name, {
        public: true,
        fileSizeLimit: 1024 * 1024,
        allowedMimeTypes: ["audio/mpeg"]
      });
      if (error && !/already exists|duplicate/i.test(error.message)) throw error;
    })().catch((error) => {
      globalThis.__dictationTtsBucketReady = undefined;
      throw error;
    });
  }

  await globalThis.__dictationTtsBucketReady;
}

function cachePath(text: string, providerVoiceId: number) {
  const digest = sha256(`${providerVoiceId}\n${text.toLowerCase()}`);
  return `v3/baidu/${providerVoiceId}/${digest.slice(0, 2)}/${digest}.mp3`;
}

async function objectExists(client: SupabaseClient, path: string) {
  const slash = path.lastIndexOf("/");
  const directory = path.slice(0, slash);
  const fileName = path.slice(slash + 1);
  const { data, error } = await client.storage.from(bucketName()).list(directory, {
    limit: 1,
    search: fileName
  });
  if (error) throw error;
  return Boolean(data?.some((item) => item.name === fileName));
}

function publicUrl(client: SupabaseClient, path: string) {
  return client.storage.from(bucketName()).getPublicUrl(path).data.publicUrl;
}

async function baiduAccessToken() {
  const cached = globalThis.__dictationBaiduToken;
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  if (!globalThis.__dictationBaiduTokenRequest) {
    globalThis.__dictationBaiduTokenRequest = (async () => {
      const url = new URL("https://aip.baidubce.com/oauth/2.0/token");
      url.searchParams.set("grant_type", "client_credentials");
      url.searchParams.set("client_id", requiredEnvironment("BAIDU_SPEECH_API_KEY"));
      url.searchParams.set("client_secret", requiredEnvironment("BAIDU_SPEECH_SECRET_KEY"));

      const response = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      const result = (await response.json()) as {
        access_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      };

      if (!response.ok || !result.access_token) {
        throw new Error(
          `百度语音鉴权失败：${result.error_description || result.error || `HTTP ${response.status}`}`
        );
      }

      const lifetimeSeconds = Math.max(60, Number(result.expires_in) || 2_592_000);
      globalThis.__dictationBaiduToken = {
        value: result.access_token,
        expiresAt: Date.now() + Math.max(60, lifetimeSeconds - 300) * 1000
      };
      return result.access_token;
    })().finally(() => {
      globalThis.__dictationBaiduTokenRequest = undefined;
    });
  }

  return globalThis.__dictationBaiduTokenRequest;
}

async function synthesizeBaiduMp3(text: string, voiceId: CloudSpeechVoiceId) {
  const voice = cloudSpeechVoice(voiceId);
  const body = new URLSearchParams({
    tex: text,
    tok: await baiduAccessToken(),
    cuid: process.env.BAIDU_SPEECH_CUID?.trim() || "english-exercise-server",
    ctp: "1",
    lan: "zh",
    spd: "5",
    pit: "5",
    vol: "9",
    per: String(voice.providerVoiceId),
    aue: "3"
  });

  const response = await fetch("https://tsn.baidu.com/text2audio", {
    method: "POST",
    headers: {
      Accept: "audio/mp3, application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body,
    cache: "no-store"
  });

  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!response.ok || !contentType.startsWith("audio/")) {
    const details = (await response.text()).trim();
    let message = details;
    try {
      const result = JSON.parse(details) as { err_msg?: string; err_no?: number };
      message = [result.err_msg, result.err_no && `错误码 ${result.err_no}`].filter(Boolean).join("，");
    } catch {
      // Keep the original response text when Baidu does not return JSON.
    }
    throw new Error(`百度语音生成失败：${message || `HTTP ${response.status}`}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (!audio.length) throw new Error("百度语音生成失败：返回的音频为空");
  return audio;
}

export async function cachedSpeechResult(text: string, voiceId: CloudSpeechVoiceId) {
  const voice = cloudSpeechVoice(voiceId);
  const client = supabaseAdmin();
  const path = cachePath(text, voice.providerVoiceId);
  await ensureBucket(client);

  if (await objectExists(client, path)) {
    return { url: publicUrl(client, path), source: "cache" as const };
  }

  const mp3 = await synthesizeBaiduMp3(text, voice.id);
  const { error } = await client.storage.from(bucketName()).upload(path, mp3, {
    cacheControl: "31536000",
    contentType: "audio/mpeg",
    upsert: false
  });

  if (error && !/already exists|duplicate|resource already exists/i.test(error.message)) throw error;
  return { url: publicUrl(client, path), source: "generated" as const };
}

export async function cachedSpeechUrl(text: string, voiceId: CloudSpeechVoiceId) {
  return (await cachedSpeechResult(text, voiceId)).url;
}
