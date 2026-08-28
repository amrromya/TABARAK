import { convertFileSrc } from "@tauri-apps/api/core";

const NOTIF_SOUND_KEY = "tabarak_notif_sound";
const NOTIF_ENABLED_KEY = "tabarak_notif_enabled";
const SUCCESS_SOUND_KEY = "tabarak_success_sound";
const ERROR_SOUND_KEY = "tabarak_error_sound";

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

export function playNotifSound() {
  if (!isNotifEnabled()) return;
  const saved = getNotifSoundPath();
  try {
    stopCurrentAudio();
    if (saved) {
      const src = convertFileSrc(saved);
      audioEl = new Audio(src);
      audioEl.volume = 0.7;
      audioEl.play().catch(() => {});
    } else {
      playTone(880, 0.5, 0.3, "sine");
    }
  } catch {}
}

export function playSuccessSound() {
  if (!isNotifEnabled()) return;
  const saved = getSuccessSoundPath();
  try {
    stopCurrentAudio();
    if (saved) {
      const src = convertFileSrc(saved);
      audioEl = new Audio(src);
      audioEl.volume = 0.7;
      audioEl.play().catch(() => {});
    } else {
      // م柞د نجاح: نغمة صاعدة
      const ctx = new AudioContext();
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = "sine";
      osc1.frequency.value = 523;
      gain1.gain.value = 0.3;
      osc1.start();
      osc1.frequency.exponentialRampToValueAtTime(784, ctx.currentTime + 0.15);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc1.stop(ctx.currentTime + 0.4);
    }
  } catch {}
}

export function playErrorSound() {
  if (!isNotifEnabled()) return;
  const saved = getErrorSoundPath();
  try {
    stopCurrentAudio();
    if (saved) {
      const src = convertFileSrc(saved);
      audioEl = new Audio(src);
      audioEl.volume = 0.7;
      audioEl.play().catch(() => {});
    } else {
      // صوت خطأ: نغمة نازلة
      const ctx = new AudioContext();
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = "square";
      osc1.frequency.value = 400;
      gain1.gain.value = 0.2;
      osc1.start();
      osc1.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc1.stop(ctx.currentTime + 0.5);
    }
  } catch {}
}

function playTone(freq: number, duration: number, vol: number, type: OscillatorType = "sine") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  } catch {}
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
