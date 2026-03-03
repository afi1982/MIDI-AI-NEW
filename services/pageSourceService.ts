
// services/pageSourceService.ts

const SYSTEM_UI_MAP = {
    "CREATE_PAGE": {
        "title": "דף היצירה (Generation Settings)",
        "tools": [
            "בחירת ז'אנר (Music Genre): Full-On, Power, Goa, Melodic Techno, Peak Techno",
            "בורר ערוצים (Channel Selector): לוח לבחירת 15 ערוצי Elite (Kick, Sub, Leads, Arps, Percs)",
            "כפתור סנתז (Zap Button): הפעלת מנוע ה-Maestro V114"
        ]
    },
    "STUDIO_PAGE": {
        "title": "הסטודיו (Pro Studio)",
        "tools": [
            "Timeline & Piano Roll: עריכה גרפית מתקדמת של קליפים ותווים",
            "Spectral Monitor: ויזואליזציה של הספקטרום בזמן אמת",
            "Channel Inspector: שליטה על Volume, Cutoff ו-Presets"
        ]
    },
    "LOOP_GEN": {
        "title": "מחולל הלופים (Loop Gen)",
        "tools": [
            "יצירת ערוצים בודדים (Single Channel Builder)",
            "מנוע ווריאציות אינסופי: שימוש ב-voicingPool ו-mutateMotif",
            "סנכרון סשן: כל לופ חדש נבנה על בסיס הפרופיל (Profile) הקיים בדף"
        ],
        "logic_files": [
            "services/melodicComposer.ts: ניהול ווריאציות PAD ומוטיבים",
            "services/maestroService.ts: תזמור וסידור הקליפים"
        ]
    },
    "AUDIO_LAB": {
        "title": "מעבדת האודיו (AI Audio Lab)",
        "tools": [
            "Forensics: פירוק אודיו למידי (Audio to MIDI Deconstruction)",
            "Maestro V114.2 PRO: שחזור אקוסטי בדיוק של מילי-שניות",
            "Scale Integrity: ויזואליזציה של תווים בסולם מול ארטיפקטים"
        ],
        "logic_files": [
            "services/audioAnalysisService.ts: ניתוח גלי קול באמצעות Gemini Pro",
            "services/contextBridgeService.ts: תיקון הרמוני מבוסס הקשר"
        ]
    }
};

export const getFullSystemManifest = (): string => {
    return `
מפרט מערכת מלא - MIDI AI V114 PRO
=====================================================
סטטוס לוגיקה: V114.2 (Acoustic Fidelity Enabled)

תכולת הדפים והקבצים המרכזיים:
${Object.entries(SYSTEM_UI_MAP).map(([key, data]) => `
[דף: ${data.title}]
כלים:
${data.tools.map(t => `- ${t}`).join('\n')}
קבצי לוגיקה קשורים:
${(data as any).logic_files?.map((f: string) => `- ${f}`).join('\n') || '- N/A'}
`).join('\n')}

לוגיקה פנימית (Core Services):
1. melodicComposer.ts: מייצר תנועה מלודית ייחודית בכל Generate ע"י היפוכים (Inversions).
2. maestroService.ts: מנהל את הזרימה המוזיקלית וה-Arrangement.
3. contextBridgeService.ts: מגשר בין סגנונות (Techno/Trance) לתיקוני מידי אוטומטיים.
4. theoryEngine.ts: אוכף סולמות (Scale Enforcer) ברמת התו הבודד.
    `;
};

export const downloadPageSource = (pageKey: string) => {
    const text = getFullSystemManifest();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SYSTEM_BLUEPRINT_V114_PRO.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
