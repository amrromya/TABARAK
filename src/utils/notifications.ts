const NOTIF_SOUND_KEY = "tabarak_notif_sound";
const NOTIF_ENABLED_KEY = "tabarak_notif_enabled";
const SUCCESS_SOUND_KEY = "tabarak_success_sound";
const ERROR_SOUND_KEY = "tabarak_error_sound";

import { invoke } from "@tauri-apps/api/core";

export type BuiltInSoundId =
  | "success_default" | "success_bell" | "success_pop"
  | "error_default" | "error_buzz" | "error_thud"
  | "notif_default" | "notif_chime" | "notif_ping";

const BUILT_IN_SOUNDS: Record<BuiltInSoundId, string> = {
  success_default: "/sounds/success.wav",
  success_bell: "/sounds/success_bell.wav",
  success_pop: "/sounds/success_pop.wav",
  error_default: "/sounds/error.wav",
  error_buzz: "/sounds/error_buzz.wav",
  error_thud: "/sounds/error_thud.wav",
  notif_default: "/sounds/notif.wav",
  notif_chime: "/sounds/notif_chime.wav",
  notif_ping: "/sounds/notif_ping.wav",
};

function isBuiltIn(id: string): id is BuiltInSoundId {
  return id in BUILT_IN_SOUNDS;
}

export function isNotifEnabled(): boolean {
  const v = localStorage.getItem(NOTIF_ENABLED_KEY);
  return v === null ? true : v === "true";
}

export function setNotifEnabled(v: boolean) {
  localStorage.setItem(NOTIF_ENABLED_KEY, String(v));
}

export function getNotifSoundPath(): string | null {
  return localStorage.getItem(NOTIF_SOUND_KEY);
}

export function setNotifSoundPath(p: string | null) {
  if (p) localStorage.setItem(NOTIF_SOUND_KEY, p);
  else localStorage.removeItem(NOTIF_SOUND_KEY);
}

export function getSuccessSoundPath(): string | null {
  return localStorage.getItem(SUCCESS_SOUND_KEY);
}

export function setSuccessSoundPath(p: string | null) {
  if (p) localStorage.setItem(SUCCESS_SOUND_KEY, p);
  else localStorage.removeItem(SUCCESS_SOUND_KEY);
}

export function getErrorSoundPath(): string | null {
  return localStorage.getItem(ERROR_SOUND_KEY);
}

export function setErrorSoundPath(p: string | null) {
  if (p) localStorage.setItem(ERROR_SOUND_KEY, p);
  else localStorage.removeItem(ERROR_SOUND_KEY);
}

let audioEl: HTMLAudioElement | null = null;
const blobUrlCache = new Map<string, string>();

function stopCurrentAudio() {
  if (audioEl) { audioEl.pause(); audioEl = null; }
}

function playSound(url: string, volume = 0.7) {
  stopCurrentAudio();
  audioEl = new Audio(url);
  audioEl.volume = volume;
  audioEl.play().catch(() => {});
}

function guessMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "mp3";
  const map: Record<string, string> = {
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
    m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac",
  };
  return map[ext] || "audio/mpeg";
}

async function resolveUrl(saved: string | null, defaultId: BuiltInSoundId): Promise<string> {
  if (saved && isBuiltIn(saved)) {
    return BUILT_IN_SOUNDS[saved];
  }
  if (saved) {
    if (blobUrlCache.has(saved)) return blobUrlCache.get(saved)!;
    try {
      const b64: string = await invoke("read_file_base64", { path: saved });
      const mime = guessMime(saved);
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      blobUrlCache.set(saved, url);
      return url;
    } catch {
      return BUILT_IN_SOUNDS[defaultId];
    }
  }
  return BUILT_IN_SOUNDS[defaultId];
}

export async function playNotifSound() {
  if (!isNotifEnabled()) return;
  try { playSound(await resolveUrl(getNotifSoundPath(), "notif_default")); } catch {}
}

export async function playSuccessSound() {
  if (!isNotifEnabled()) return;
  try { playSound(await resolveUrl(getSuccessSoundPath(), "success_default")); } catch {}
}

export async function playErrorSound() {
  if (!isNotifEnabled()) return;
  try { playSound(await resolveUrl(getErrorSoundPath(), "error_default")); } catch {}
}

export function playBuiltInSound(id: BuiltInSoundId) {
  playSound(BUILT_IN_SOUNDS[id]);
}

export interface NotifRecord {
  id: number;
  employee_name: string;
  type: "check_in" | "check_out";
  time: string;
}

let notifToast: ((msg: string, type?: "success" | "error" | "info") => void) | null = null;

export function setNotifToast(fn: (msg: string, type?: "success" | "error" | "info") => void) {
  notifToast = fn;
}

export function showDesktopNotif(r: NotifRecord) {
  if (!isNotifEnabled()) return;
  const title = r.type === "check_in" ? "✅ تسجيل حضور" : "🚪 تسجيل انصراف";
  const body = `${r.employee_name} — ${r.time}`;

  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(title, { body, tag: `att-${r.id}` });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((p) => {
        if (p === "granted") new Notification(title, { body, tag: `att-${r.id}` });
      });
    }
  }

  if (notifToast) notifToast(`${title}: ${body}`, "info");
  playNotifSound();
}
