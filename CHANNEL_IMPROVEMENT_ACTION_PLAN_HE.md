# תוכנית פעולה לשיפור איכות הערוצים וה-MIDI

## מטרה
להעלות משמעותית את איכות קבצי ה‑MIDI המופקים בכל אחד מהמסלולים:
1. דף היצירה הראשי
2. דף LOOP GAN
3. דף AUDIO TO MIDI

---

## KPI ויעדי איכות (חובה למדידה)

### KPI מוזיקליים
- **Timing Tightness**: סטיית קוונטיזציה ממוצעת < 15ms.
- **Velocity Musicality**: טווח דינמיקה בריא (ללא velocity שטוח סביב ערך אחד).
- **Harmonic Validity**: לפחות 90% מהתווים בסולם/אקורדים שנבחרו.
- **Structure Score**: נוכחות מבנה ברור (Intro/Verse/Hook/Outro) ב־80% מהיצירות.
- **Channel Diversity**: בידול תפקידים בין ערוצים (Drums/Bass/Chords/Melody).

### KPI מוצר
- ירידה של 40% בדיווחי "תוצאה לא מוזיקלית".
- שיפור של 25% בדירוג משתמשים (A/B test).
- ירידה בכמות העריכות הידניות שהמשתמש נדרש לבצע אחרי יצירה.

---

## שלב 1 — תשתית דאטה ואבחון (שבוע 1)

1. **איסוף 500–1000 יצירות בעייתיות** מכל שלושת הדפים.
2. **תיוג אוטומטי + ידני**:
   - Off-beat, חוסר הרמוניה, חזרתיות יתר, צפיפות/דלילות.
3. **בניית דשבורד איכות** לפי מקור יצירה (Main / Loop GAN / Audio2MIDI).
4. **Root Cause Analysis** לכל pipeline:
   - Pre-processing
   - מודל
   - Post-processing
   - MIDI rendering

Deliverable: דוח אבחון ממוקד עם Top-5 תקלות לכל דף.

---

## שלב 2 — שדרוג מנוע מוזיקלי משותף (שבועות 2–3)

1. **Music Rules Engine (Post-Processor משותף)**
   - תיקון סולם/אקורדים (Scale/Chord snap).
   - תיקון טיימינג אדפטיבי (Humanize + Quantize intelligent).
   - תיקון Voice Leading בסיסי.
   - נרמול velocity לפי תפקיד ערוץ.

2. **תבניות תפקידי ערוצים (Channel Role Templates)**
   - Drums: kick/snare/hat grammar.
   - Bass: חיבור root + approach notes.
   - Chords: voicings לפי ז'אנר.
   - Melody: phrase length + מוטיבים חוזרים נשלטים.

3. **Structure Generator**
   - יצירת פרקים מוזיקליים קצרים עם וריאציה מבוקרת.
   - מניעת copy-paste לופים זהים לאורך כל הקטע.

Deliverable: ספריית Post-processing אחידה לכל המסלולים.

---

## שלב 3 — שיפורים ספציפיים לכל דף

### A) דף יצירה ראשי (שבוע 4)
- הוספת מצב "Quality First" על פני "Fast First".
- שימוש ב־multi-pass generation:
  1. שלד הרמוני/קצבי
  2. מילוי ערוצים
  3. polishing rules
- מנגנון Re-roll חכם רק לערוץ חלש במקום יצירה מחדש של הכול.

### B) דף LOOP GAN (שבוע 5)
- שדרוג loss פונקציות:
  - rhythmic consistency loss
  - harmonic coherence loss
  - repetition penalty
- אימון עם Negative examples (לופים גרועים) כדי ללמד "מה לא לייצר".
- מעבר ל־bar-aware generation (הבנת גבולות תיבה) לשיפור גרוב.

### C) דף AUDIO TO MIDI (שבוע 6)
- שיפור transcription pipeline:
  - Onset detection מדויק יותר
  - Pitch tracking עם smoothing
  - Note segmentation חכם (מניעת פיצול/איחוד שגוי)
- תיקוני MIDI אחרי תמלול:
  - הסרת ghost notes חריגים
  - quantization לפי BPM מזוהה
  - תיקון אוקטבות שגויות
- הפרדה טובה יותר בין תפקידים בכלי רב-קולי (אם יש polyphony).

Deliverable: גרסה משופרת לכל אחד משלושת הדפים עם מדדים השוואתיים לפני/אחרי.

---

## שלב 4 — QA מוזיקלי ו-A/B (שבוע 7)

1. **בדיקות אוטומטיות** לכל יצירה:
   - בדיקת סולם/אקורדים
   - צפיפות תווים
   - סטיית timing
   - טווח velocity
2. **בליינד טסט** עם מאזינים/מוזיקאים (לפחות 30 נבדקים).
3. **A/B בפרודקשן**:
   - מודל ישן מול חדש
   - השוואת שביעות רצון + retention

Deliverable: החלטת Go/No-Go עם ספי איכות מוגדרים.

---

## שלב 5 — שיפור רציף (מתמשך)

- לולאת Feedback מהמשתמש:
  - "ערוץ חלש" + סוג התקלה בלחיצה אחת.
- Fine-tuning דו-שבועי על נתוני אמת.
- Leaderboard פנימי לגרסאות מודל לפי KPI מוזיקליים.

---

## חלוקת אחריות מומלצת

- **ML Engineer**: מודלים, loss, fine-tuning
- **Music Tech / MIDI Engineer**: rules engine + rendering
- **Backend Engineer**: telemetry, pipelines, feature flags
- **Product + QA מוזיקלי**: הגדרת KPI, בדיקות מאזינים, A/B

---

## לוח זמנים קצר

- שבוע 1: אבחון ו-KPI baseline
- שבועות 2–3: מנוע איכות משותף
- שבועות 4–6: שיפור ייעודי לכל דף
- שבוע 7: QA + A/B + החלטת השקה

---

## סיכונים ואיך מצמצמים

1. **שיפור טכני בלי שיפור שמיעתי אמיתי**
   - פתרון: בדיקות האזנה אנושיות כחלק חובה.
2. **Latency גבוהה מדי**
   - פתרון: מצב Fast/Quality והאצת post-process.
3. **Over-quantization (תוצאה רובוטית)**
   - פתרון: Humanize נשלט לפי ז'אנר.

---

## תוצאה צפויה
אם מבצעים את התוכנית במלואה, תוך 6–8 שבועות ניתן להגיע לקפיצה ניכרת באיכות המוזיקלית בכל שלושת הדפים, עם תוצרים עקביים יותר, מוזיקליים יותר, ופחות צורך בתיקון ידני מצד המשתמש.
