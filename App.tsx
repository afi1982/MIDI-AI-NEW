import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileText,
  Globe2,
  Languages,
  ListChecks,
  Menu,
  Mic2,
  MousePointerClick,
  Play,
  ShieldCheck,
  Sparkles,
  Subtitles,
  UploadCloud,
  WandSparkles,
  X,
} from 'lucide-react';

const PRODUCT_URL = 'https://aiecholearn.vercel.app/he';

const tools = [
  {
    number: '01',
    icon: FileText,
    eyebrow: 'ללימודים ולהרצאות',
    title: 'סיכום שמוציא את העיקר',
    description:
      'הופכים שיעור, וובינר או סרטון לדו״ח מסודר עם תקציר, נקודות מפתח והסבר למונחים — מוכן לקריאה ולשמירה.',
    output: 'דו״ח PDF מסודר להורדה',
    cta: 'ליצירת סיכום',
    href: `${PRODUCT_URL}/app`,
    variant: 'blue',
  },
  {
    number: '02',
    icon: Subtitles,
    eyebrow: 'ליוצרים ולעסקים',
    title: 'כתוביות שאי אפשר לפספס',
    description:
      'מעלים סרטון ומקבלים כתוביות מדויקות ומתוזמנות לדיבור. בוחרים שפה, סגנון ומיקום — ומורידים סרטון מוכן לפרסום.',
    output: 'וידאו עם כתוביות או קובץ SRT',
    cta: 'ליצירת כתוביות',
    href: `${PRODUCT_URL}/subtitles`,
    variant: 'coral',
  },
  {
    number: '03',
    icon: ListChecks,
    eyebrow: 'לצוותים ולפגישות',
    title: 'פרוטוקול שסוגר את הפינות',
    description:
      'מקליטים פגישה או מעלים שיחה קיימת. בסיום מקבלים משתתפים, החלטות, משימות ואחראים — בלי לרדוף אחרי פתקים.',
    output: 'פרוטוקול מקצועי ב‑PDF',
    cta: 'לסיכום פגישה',
    href: `${PRODUCT_URL}/meeting`,
    variant: 'yellow',
  },
];

const steps = [
  {
    number: '1',
    icon: UploadCloud,
    title: 'מעלים או מקליטים',
    text: 'קובץ, קישור, מיקרופון או טאב בדפדפן — בוחרים מה שנוח.',
  },
  {
    number: '2',
    icon: Languages,
    title: 'בוחרים שפה ותוצאה',
    text: 'סיכום, כתוביות או פרוטוקול, בעברית או באחת מ־15 שפות.',
  },
  {
    number: '3',
    icon: Sparkles,
    title: 'מקבלים קובץ מוכן',
    text: 'תוצאה ברורה ומאורגנת שאפשר להוריד, לשתף ולהתחיל לעבוד איתה.',
  },
];

const audiences = [
  'סטודנטים ומרצים',
  'יוצרי תוכן',
  'צוותים ומנהלים',
  'עצמאים ויועצים',
];

const faqs = [
  {
    question: 'מה אפשר לעשות עם EchoLearn?',
    answer:
      'אפשר להפוך שיעורים וסרטונים לסיכומי PDF, להוסיף לסרטונים כתוביות מתוזמנות, וליצור פרוטוקול מקצועי מפגישות ושיחות.',
  },
  {
    question: 'האם המערכת עובדת בעברית?',
    answer:
      'כן. הממשק והתוצרים זמינים בעברית, וניתן לתמלל ולתרגם תוכן במגוון שפות — כולל עברית, אנגלית וערבית.',
  },
  {
    question: 'מה קורה לקבצים שהעליתי?',
    answer:
      'EchoLearn בנוי בגישה שמצמצמת שמירת מידע: האודיו נמחק מהשרת לאחר העיבוד, וקובץ הווידאו של כלי הכתוביות נשאר בדפדפן.',
  },
  {
    question: 'צריך להתקין תוכנה?',
    answer:
      'לא. הכול פועל ישירות בדפדפן. נכנסים לאתר, בוחרים כלי ומתחילים.',
  },
];

const languages = [
  'עברית',
  'العربية',
  'English',
  'Español',
  'Français',
  'Deutsch',
  'Português',
  'Русский',
  '中文',
  '日本語',
];

function Logo() {
  return (
    <a className="brand" href="#top" aria-label="EchoLearn — חזרה לראש הדף">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="brand-name">EchoLearn</span>
    </a>
  );
}

function ProductLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
    >
      {children}
    </a>
  );
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>('[data-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.classList.toggle('menu-is-open', menuOpen);
    return () => document.body.classList.remove('menu-is-open');
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="site-shell" dir="rtl">
      <header className="site-header">
        <div className="container nav-wrap">
          <Logo />

          <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="ניווט ראשי">
            <a href="#tools" onClick={closeMenu}>מה אפשר לעשות</a>
            <a href="#how" onClick={closeMenu}>איך זה עובד</a>
            <a href="#privacy" onClick={closeMenu}>פרטיות</a>
            <a href="#faq" onClick={closeMenu}>שאלות נפוצות</a>
            <ProductLink href={PRODUCT_URL} className="button button-dark nav-mobile-cta" onClick={closeMenu}>
              מתחילים עכשיו
              <ArrowLeft size={17} />
            </ProductLink>
          </nav>

          <ProductLink href={PRODUCT_URL} className="button button-dark nav-cta">
            כניסה ל‑EchoLearn
            <ArrowLeft size={17} />
          </ProductLink>

          <button
            type="button"
            className="menu-button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label={menuOpen ? 'סגירת תפריט' : 'פתיחת תפריט'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <main>
        <section className="hero" id="top">
          <div className="hero-grid" aria-hidden="true" />
          <div className="container hero-layout">
            <div className="hero-copy" data-reveal>
              <div className="eyebrow">
                <span className="live-dot" />
                תמלול, תרגום וסיכום חכם
              </div>
              <h1>
                מפסיקים להקשיב
                <span className="headline-accent"> שוב.</span>
                <br />
                מתחילים לקרוא חכם.
              </h1>
              <p className="hero-lead">
                הופכים שיעורים, פגישות וסרטונים לידע מסודר — סיכום ברור, כתוביות מוכנות או פרוטוקול מקצועי. בעברית, תוך דקות.
              </p>
              <div className="hero-actions">
                <ProductLink href={PRODUCT_URL} className="button button-primary button-large">
                  נסו את EchoLearn
                  <ArrowLeft size={21} />
                </ProductLink>
                <a className="text-link" href="#tools">
                  גלו מה אפשר לעשות
                  <ChevronDown size={18} />
                </a>
              </div>
              <div className="hero-notes" aria-label="יתרונות מרכזיים">
                <span><Check size={15} /> ללא התקנה</span>
                <span><Check size={15} /> 15 שפות</span>
                <span><Check size={15} /> האודיו נמחק אחרי העיבוד</span>
              </div>
            </div>

            <div className="hero-visual" data-reveal>
              <div className="visual-orbit orbit-one" />
              <div className="visual-orbit orbit-two" />

              <div className="audio-card floating-card">
                <div className="audio-card-head">
                  <span className="record-icon"><Mic2 size={15} /></span>
                  <span>פגישה_שבועית.mp3</span>
                  <span className="audio-time">28:40</span>
                </div>
                <div className="waveform" aria-hidden="true">
                  {[18, 34, 25, 47, 64, 39, 76, 56, 91, 46, 67, 31, 73, 52, 38, 62, 29, 51, 21, 44, 27, 35].map((height, index) => (
                    <i key={index} style={{ height: `${height}%`, animationDelay: `${index * 45}ms` }} />
                  ))}
                </div>
                <div className="audio-progress"><span /></div>
              </div>

              <div className="document-card">
                <div className="document-topbar">
                  <div className="document-brand"><span className="mini-mark" /> EchoLearn</div>
                  <span>PDF · מוכן</span>
                </div>
                <div className="document-body">
                  <div className="document-kicker">סיכום פגישה · 23.08.2026</div>
                  <h2>סנכרון צוות — רבעון 3</h2>
                  <p className="document-summary">
                    הוחלט להתמקד בהשקת הקמפיין החדש ולהשלים את חומרי הקריאייטיב עד סוף השבוע.
                  </p>
                  <div className="document-divider" />
                  <div className="document-section-title"><ListChecks size={17} /> החלטות ומשימות</div>
                  <ul className="task-list">
                    <li><span className="task-check"><Check size={13} /></span><span>אישור התקציב הסופי</span><b>דנה</b></li>
                    <li><span className="task-check"><Check size={13} /></span><span>הכנת 3 וריאציות קריאייטיב</span><b>יוסי</b></li>
                    <li><span className="task-check"><Check size={13} /></span><span>הגדרת מדדי הצלחה</span><b>מיכל</b></li>
                  </ul>
                </div>
              </div>

              <div className="status-card floating-card">
                <span className="status-icon"><WandSparkles size={18} /></span>
                <span><b>העיבוד הושלם</b><small>הקובץ מוכן להורדה</small></span>
                <Check size={18} />
              </div>

              <div className="caption-card floating-card">
                <span className="caption-play"><Play size={13} fill="currentColor" /></span>
                <p><span>את</span> ההחלטות שקיבלנו</p>
              </div>
            </div>
          </div>

          <div className="container proof-strip" data-reveal>
            <div className="proof-intro">
              <span>כל מה שנאמר</span>
              <strong>הופך למשהו שאפשר להשתמש בו</strong>
            </div>
            <div className="proof-items">
              <span><Clock3 size={18} /> חוסכים שעות של צפייה חוזרת</span>
              <span><FileText size={18} /> מקבלים תוצאה מסודרת</span>
              <span><Globe2 size={18} /> עובדים בשפה שנוחה לכם</span>
            </div>
          </div>
        </section>

        <section className="section tools-section" id="tools">
          <div className="container">
            <div className="section-heading" data-reveal>
              <div>
                <span className="section-index">[ 01 ]</span>
                <p className="section-label">שלושה כלים. אפס בלגן.</p>
              </div>
              <h2>בוחרים מה צריך לקבל בסוף</h2>
              <p>אותו תוכן, תוצאה שמתאימה בדיוק למשימה שלכם.</p>
            </div>

            <div className="tool-grid">
              {tools.map((tool, index) => {
                const Icon = tool.icon;
                return (
                  <article
                    className={`tool-card tool-${tool.variant}`}
                    key={tool.title}
                    data-reveal
                    style={{ transitionDelay: `${index * 100}ms` }}
                  >
                    <div className="tool-card-top">
                      <span className="tool-number">{tool.number}</span>
                      <span className="tool-icon"><Icon size={24} /></span>
                    </div>
                    <p className="tool-eyebrow">{tool.eyebrow}</p>
                    <h3>{tool.title}</h3>
                    <p className="tool-description">{tool.description}</p>
                    <div className="tool-output"><Check size={16} /> {tool.output}</div>
                    <ProductLink href={tool.href} className="tool-link">
                      {tool.cta}
                      <ArrowLeft size={18} />
                    </ProductLink>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section how-section" id="how">
          <div className="container how-layout">
            <div className="how-copy" data-reveal>
              <span className="section-index">[ 02 ]</span>
              <p className="section-label">פשוט מהרגע הראשון</p>
              <h2>מתוכן גולמי לתוצאה מוכנה, בשלושה צעדים.</h2>
              <p>
                בלי תוכנה מורכבת ובלי ללמוד מערכת חדשה. EchoLearn עובד ישירות מהדפדפן ומוביל אתכם צעד אחר צעד.
              </p>
              <ProductLink href={PRODUCT_URL} className="button button-light">
                לפתיחת המערכת
                <ExternalLink size={17} />
              </ProductLink>
            </div>

            <div className="steps-list">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div className="step-item" key={step.number} data-reveal style={{ transitionDelay: `${index * 90}ms` }}>
                    <span className="step-number">0{step.number}</span>
                    <span className="step-icon"><Icon size={23} /></span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section audience-section">
          <div className="container audience-layout">
            <div className="audience-visual" data-reveal>
              <div className="video-frame">
                <div className="video-frame-top"><span /> <span /> <span /></div>
                <div className="video-person" aria-hidden="true">
                  <div className="person-head" />
                  <div className="person-body" />
                  <div className="person-screen" />
                </div>
                <div className="video-controls"><Play size={14} fill="currentColor" /><span className="video-line"><i /></span><small>08:16 / 42:00</small></div>
                <div className="video-caption">תרגול מפוזר <mark>עדיף</mark> על תרגול צפוף</div>
              </div>
              <div className="translation-tag"><Languages size={16} /> תרגום אוטומטי לעברית</div>
            </div>

            <div className="audience-copy" data-reveal>
              <span className="section-index">[ 03 ]</span>
              <p className="section-label">נבנה לעבודה אמיתית</p>
              <h2>לכל מי שיש לו יותר תוכן מזמן.</h2>
              <p>
                חומרי לימוד, שיחות צוות, סרטונים לרשת או פגישה עם לקוח — מקבלים את המידע החשוב בפורמט שקל להבין וקל להעביר הלאה.
              </p>
              <div className="audience-tags">
                {audiences.map((audience) => <span key={audience}><Check size={15} /> {audience}</span>)}
              </div>
            </div>
          </div>
        </section>

        <section className="languages-section" aria-label="שפות נתמכות">
          <div className="languages-track">
            {[...languages, ...languages].map((language, index) => (
              <React.Fragment key={`${language}-${index}`}>
                <span>{language}</span><i>◆</i>
              </React.Fragment>
            ))}
          </div>
        </section>

        <section className="section privacy-section" id="privacy">
          <div className="container privacy-card" data-reveal>
            <div className="privacy-icon"><ShieldCheck size={34} /></div>
            <div className="privacy-copy">
              <span className="section-label">הקבצים שלכם הם לא חומר גלם שלנו</span>
              <h2>פרטיות היא חלק מהמוצר.</h2>
              <p>
                העיבוד נועד ליצור עבורכם את התוצאה שביקשתם — לא לאסוף מידע. האודיו נמחק מהשרת לאחר העיבוד, ובכלי הכתוביות הווידאו נשאר בדפדפן שלכם.
              </p>
            </div>
            <div className="privacy-points">
              <span><Check size={18} /> ללא עוגיות מעקב</span>
              <span><Check size={18} /> מידע מוצפן בתהליך</span>
              <span><Check size={18} /> שליטה בידיים שלכם</span>
            </div>
          </div>
        </section>

        <section className="section faq-section" id="faq">
          <div className="container faq-layout">
            <div className="faq-heading" data-reveal>
              <span className="section-index">[ 04 ]</span>
              <p className="section-label">לפני שמתחילים</p>
              <h2>כמה תשובות קצרות.</h2>
              <p>לא מצאתם תשובה? אפשר פשוט להיכנס למערכת ולראות איך היא עובדת.</p>
            </div>

            <div className="faq-list" data-reveal>
              {faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div className={`faq-item ${isOpen ? 'is-open' : ''}`} key={faq.question}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      aria-expanded={isOpen}
                    >
                      <span>{faq.question}</span>
                      <ChevronDown size={20} />
                    </button>
                    <div className="faq-answer" aria-hidden={!isOpen}>
                      <p>{faq.answer}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="final-cta-section">
          <div className="container final-cta" data-reveal>
            <div className="cta-spark spark-a">✦</div>
            <div className="cta-spark spark-b">✦</div>
            <span className="cta-kicker"><MousePointerClick size={17} /> בלי התקנה. פשוט מתחילים.</span>
            <h2>יש לכם הקלטה?<br />הגיע הזמן להפוך אותה לידע.</h2>
            <p>בחרו כלי, העלו את התוכן וקבלו תוצאה שאפשר לעבוד איתה.</p>
            <ProductLink href={PRODUCT_URL} className="button button-primary button-large">
              מתחילים עם EchoLearn
              <ArrowLeft size={21} />
            </ProductLink>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-top">
          <div>
            <Logo />
            <p>הופכים הקלטות, פגישות וסרטונים לידע ברור ושימושי.</p>
          </div>
          <div className="footer-links">
            <div>
              <strong>כלים</strong>
              <a href={`${PRODUCT_URL}/app`} target="_blank" rel="noopener noreferrer">סיכום הרצאה</a>
              <a href={`${PRODUCT_URL}/subtitles`} target="_blank" rel="noopener noreferrer">כתוביות לסרטון</a>
              <a href={`${PRODUCT_URL}/meeting`} target="_blank" rel="noopener noreferrer">סיכום פגישה</a>
            </div>
            <div>
              <strong>מידע</strong>
              <a href="#how">איך זה עובד</a>
              <a href="#privacy">פרטיות</a>
              <a href={`${PRODUCT_URL}/terms`} target="_blank" rel="noopener noreferrer">תנאי שימוש</a>
            </div>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 EchoLearn. כל הזכויות שמורות.</span>
          <span>נבנה כדי להפוך הקשבה להבנה.</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
