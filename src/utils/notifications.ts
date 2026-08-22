import { convertFileSrc } from "@tauri-apps/api/core";

const NOTIF_SOUND_KEY = "tabarak_notif_sound";
const NOTIF_ENABLED_KEY = "tabarak_notif_enabled";

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

let audioEl: HTMLAudioElement | null = null;

export function playNotifSound() {
  if (!isNotifEnabled()) return;
  const saved = getNotifSoundPath();
  try {
    if (audioEl) { audioEl.pause(); audioEl = null; }
    if (saved) {
      const src = convertFileSrc(saved);
      audioEl = new Audio(src);
      audioEl.volume = 0.7;
      audioEl.play().catch(() => {});
    } else {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.stop(ctx.currentTime + 0.5);
      } catch {}
    }
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
