
import * as Tone from 'tone';

export const NotificationService = {
    requestPermission: async () => {
        if (!("Notification" in window)) return false;
        if (Notification.permission === "granted") return true;
        const result = await Notification.requestPermission();
        return result === "granted";
    },

    notify: (title: string, body: string) => {
        // 1. Browser Notification
        if ("Notification" in window && Notification.permission === "granted") {
            try {
                // Mobile browsers might restrict this if not PWA, but works on desktop
                new Notification(title, {
                    body: body,
                    icon: 'https://cdn-icons-png.flaticon.com/512/2645/2645897.png', // Generic Music Icon
                    vibrate: [200, 100, 200]
                } as any);
            } catch (e) {
                console.warn("Notification trigger failed", e);
            }
        }

        // 2. Audio Chime (Tone.js)
        try {
            const now = Tone.now();
            const synth = new Tone.PolySynth(Tone.Synth).toDestination();
            synth.triggerAttackRelease(["C5", "E5", "G5", "C6"], "8n", now);
        } catch (e) {
            console.warn("Audio chime failed", e);
        }
    }
};
