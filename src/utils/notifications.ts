import { convertFileSrc } from "@tauri-apps/api/core";
import { resolveResource } from "@tauri-apps/api/path";

const NOTIF_SOUND_KEY = "tabarak_notif_sound";
const NOTIF_ENABLED_KEY = "tabarak_notif_enabled";
const SUCCESS_SOUND_KEY = "tabarak_success_sound";
const ERROR_SOUND_KEY = "tabarak_error_sound";

export type BuiltInSoundId =
  | "success_default" | "success_bell" | "success_pop"
  | "error_default" | "error_buzz" | "error_thud"
  | "notif_default" | "notif_chime" | "notif_ping";

const BUILT_IN_SOUNDS: Record<BuiltInSoundId, string> = {
  success_default: "sounds/success.wav",
  success_bell: "sounds/success_bell.wav",
  success_pop: "sounds/success_pop.wav",
  error_default: "sounds/error.wav",
  error_buzz: "sounds/error_buzz.wav",
  error_thud: "sounds/error_thud.wav",
  notif_default: "sounds/notif.wav",
  notif_chime: "sounds/notif_chime.wav",
  notif_ping: "sounds/notif_ping.wav",
};

async function getBuiltInUrl(id: BuiltInSoundId): Promise<string> {
  const resourcePath = BUILT_IN_SOUNDS[id];
  const resolved = await resolveResource(resourcePath);
  return convertFileSrc(resolved);
}

function getCustomUrl(path: string): string {
  return convertFileSrc(path);
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

function stopCurrentAudio() {
  if (audioEl) { audioEl.pause(); audioEl = null; }
}

function playUrl(url: string, volume = 0.7) {
  stopCurrentAudio();
  audioEl = new Audio(url);
  audioEl.volume = volume;
  audioEl.play().catch(() => {});
}

async function playNotifSoundAsync() {
  if (!isNotifEnabled()) return;
  const saved = getNotifSoundPath();
  try {
    if (saved && saved.startsWith("builtin:")) {
      playUrl(await getBuiltInUrl(saved.replace("builtin:", "") as BuiltInSoundId));
    } else if (saved) {
      playUrl(getCustomUrl(saved));
    } else {
      playUrl(await getBuiltInUrl("notif_default"));
    }
  } catch {}
}

async function playSuccessSoundAsync() {
  if (!isNotifEnabled()) return;
  const saved = getSuccessSoundPath();
  try {
    if (saved && saved.startsWith("builtin:")) {
      playUrl(await getBuiltInUrl(saved.replace("builtin:", "") as BuiltInSoundId));
    } else if (saved) {
      playUrl(getCustomUrl(saved));
    } else {
      playUrl(await getBuiltInUrl("success_default"));
    }
  } catch {}
}

async function playErrorSoundAsync() {
  if (!isNotifEnabled()) return;
  const saved = getErrorSoundPath();
  try {
    if (saved && saved.startsWith("builtin:")) {
      playUrl(await getBuiltInUrl(saved.replace("builtin:", "") as BuiltInSoundId));
    } else if (saved) {
      playUrl(getCustomUrl(saved));
    } else {
      playUrl(await getBuiltInUrl("error_default"));
    }
  } catch {}
}

export function playNotifSound() { playNotifSoundAsync(); }
export function playSuccessSound() { playSuccessSoundAsync(); }
export function playErrorSound() { playErrorSoundAsync(); }

export async function playBuiltInSound(id: BuiltInSoundId) {
  playUrl(await getBuiltInUrl(id));
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
