import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// ---------------------------------------------------------------------------
// SVG Icon Component
// ---------------------------------------------------------------------------
type IconName = 
  | 'home' | 'calendar' | 'bell' | 'user' | 'clock' | 'map-pin' | 'info' 
  | 'file-text' | 'sun' | 'moon' | 'plane' | 'heart-pulse' | 'refresh-cw' 
  | 'message-circle' | 'headphones' | 'alert-circle' | 'check' | 'chevron-left' 
  | 'chevron-right' | 'logout' | 'settings' | 'help' | 'calendar-month';

/**
 * Renders an SVG icon based on the provided name.
 * 
 * @param {Object} props - Component properties
 * @param {IconName} props.name - The name of the icon to render
 * @param {number} [props.size=20] - The size of the icon in pixels
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {React.CSSProperties} [props.style] - Additional inline styles
 * @returns {React.ReactElement} The SVG icon element
 */
function Icon({ name, size = 20, className = '', style }: { name: IconName; size?: number; className?: string; style?: React.CSSProperties }) {
  const paths: Record<IconName, React.ReactNode> = {
    'home': <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    'calendar': <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    'calendar-month': <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></>,
    'bell': <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    'user': <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    'clock': <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    'map-pin': <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
    'info': <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
    'file-text': <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>,
    'sun': <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>,
    'moon': <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>,
    'plane': <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.6L3 8l6.8 5L7 16l-3.2-.8c-.4-.1-.8.2-1 .6L2 17l5.5 1.5L9 24l1.2-.8c.4-.2.7-.6.6-1l-.8-3.2 3-2.8 5 6.8c.4.5 1 .3 1.2-.2l1.2-1.8c.2-.5 0-1-.4-1.2z"/>,
    'heart-pulse': <><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/></>,
    'refresh-cw': <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>,
    'message-circle': <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>,
    'headphones': <><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></>,
    'alert-circle': <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    'check': <polyline points="20 6 9 17 4 12"/>,
    'chevron-left': <polyline points="15 18 9 12 15 6"/>,
    'chevron-right': <polyline points="9 18 15 12 9 6"/>,
    'logout': <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    'settings': <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    'help': <><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></>
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {paths[name]}
    </svg>
  );
}

/**
 * Main Dashboard Page for ShiftScheduler Enterprise
 * 
 * @returns {React.ReactElement} The dashboard component
 */
export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'manager')) {
      navigate('/admin');
    }
  }, [user, navigate]);

  /**
   * Logs out the user and redirects to login
   */
  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="bg-surface-container text-on-surface antialiased min-h-screen" dir="rtl">
      
      {/* ------------------------------------------------------------------------
          Right Sidebar (Enterprise Style)
      -------------------------------------------------------------------------- */}
      <aside className="fixed right-0 top-0 h-full w-64 bg-surface border-l border-outline/10 flex flex-col hidden md:flex z-40 shadow-sm">
        <div className="p-6 border-b border-outline/10 flex items-center space-x-3 space-x-reverse">
          <div className="w-8 h-8 bg-primary-blue rounded-lg flex items-center justify-center">
            <Icon name="calendar" size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-text-primary tracking-tight">ShiftScheduler</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto mt-2">
          <a href="#" className="flex items-center space-x-3 space-x-reverse px-4 py-3 bg-action-blue/10 text-action-blue rounded-lg font-semibold transition-colors border-r-4 border-action-blue">
            <Icon name="home" size={20} />
            <span>לוח בקרה</span>
          </a>
          <a href="#" className="flex items-center space-x-3 space-x-reverse px-4 py-3 text-text-primary/70 hover:bg-neutral-gray hover:text-text-primary rounded-lg font-medium transition-colors">
            <Icon name="calendar-month" size={20} />
            <span>המשמרות שלי</span>
          </a>
          <a href="#" className="flex items-center space-x-3 space-x-reverse px-4 py-3 text-text-primary/70 hover:bg-neutral-gray hover:text-text-primary rounded-lg font-medium transition-colors">
            <div className="relative">
              <Icon name="message-circle" size={20} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-error rounded-full"></span>
            </div>
            <span>הודעות</span>
          </a>
          <a href="#" className="flex items-center space-x-3 space-x-reverse px-4 py-3 text-text-primary/70 hover:bg-neutral-gray hover:text-text-primary rounded-lg font-medium transition-colors">
            <Icon name="settings" size={20} />
            <span>הגדרות</span>
          </a>
          <a href="#" className="flex items-center space-x-3 space-x-reverse px-4 py-3 text-text-primary/70 hover:bg-neutral-gray hover:text-text-primary rounded-lg font-medium transition-colors">
            <Icon name="help" size={20} />
            <span>עזרה</span>
          </a>
        </nav>

        <div className="p-4 border-t border-outline/10 bg-surface">
          <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-outline/10 hover:border-action-blue/30 transition-colors cursor-pointer">
            <div className="flex items-center space-x-3 space-x-reverse overflow-hidden">
              <div className="w-10 h-10 rounded-full bg-neutral-gray flex-shrink-0 flex items-center justify-center text-text-primary font-bold border border-outline/10">
                {user?.name?.charAt(0) || 'י'}
              </div>
              <div className="truncate">
                <p className="text-sm font-bold text-text-primary truncate">{user?.name || 'יוני לוי'}</p>
                <p className="text-xs text-text-primary/70 truncate">עובד בכיר</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-text-primary/50 hover:text-error transition-colors p-1" title="התנתק">
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------------------
          Main Content
      -------------------------------------------------------------------------- */}
      <main className="md:mr-64 min-h-screen flex flex-col">
        
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 md:right-64 h-20 bg-surface/80 backdrop-blur-md border-b border-outline/10 px-8 flex justify-between items-center z-30 shadow-sm">
          <div>
            <h1 className="text-3xl font-bold text-on-surface">לוח בקרה אישי</h1>
          </div>
          <div className="flex items-center space-x-4 space-x-reverse">
             {/* Additional header actions can be placed here */}
          </div>
        </header>

        {/* Dashboard Content Grid */}
        <div className="p-8 max-w-7xl mx-auto w-full space-y-6 mt-20">
          
          {/* Top Section: Next Shift & Countdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Next Shift Card (Dark Blue) */}
            <div className="lg:col-span-2 bg-primary-blue border border-primary-blue rounded-xl p-8 shadow-sm flex flex-col justify-between relative overflow-hidden">
               {/* Decorative accent */}
               <div className="absolute top-0 left-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 -translate-x-1/3 blur-2xl pointer-events-none"></div>
               
               <div className="flex justify-between items-start mb-6 relative z-10">
                 <div>
                   <h2 className="text-2xl font-bold text-white mb-2">יום ראשון, 06:45 - 14:45</h2>
                   <span className="inline-block bg-white/10 text-white text-sm font-bold px-3 py-1 rounded-full border border-white/20">משמרת בוקר</span>
                 </div>
               </div>
               
               <div className="flex items-center justify-between relative z-10 mt-auto">
                 <div className="flex items-center space-x-4 space-x-reverse p-4 bg-white/10 rounded-xl border border-white/10 backdrop-blur-sm">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary-blue font-bold">
                      ד
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">מנהלת משמרת: דניאלה כהן</p>
                      <div className="flex items-center text-xs text-inverse-primary mt-0.5 font-medium">
                        <Icon name="message-circle" size={14} className="ml-1" />
                        זמינה בהודעות
                      </div>
                    </div>
                 </div>
                 
                 <button className="bg-white text-primary-blue px-6 py-3 rounded-lg font-bold text-sm hover:bg-neutral-gray transition-colors shadow-sm">
                   צפה בפרטים
                 </button>
               </div>
            </div>

            {/* Countdown Card */}
            <div className="bg-surface border border-outline/10 rounded-xl p-8 shadow-sm flex flex-col items-center justify-center text-center">
               <div className="w-16 h-16 rounded-full bg-action-blue/10 flex items-center justify-center mb-4 text-action-blue">
                 <Icon name="clock" size={32} />
               </div>
               <p className="text-sm text-text-primary/70 font-semibold mb-2">זמן נותר למשמרת הבאה</p>
               <p className="text-4xl font-bold text-action-blue mb-2">14 שעות</p>
               <div className="w-full bg-neutral-gray h-2 rounded-full mt-4 mb-2 overflow-hidden">
                 <div className="bg-action-blue h-full rounded-full" style={{ width: '75%' }}></div>
               </div>
               <p className="text-xs text-text-primary/50">75% מהזמן החופשי נוצל</p>
            </div>

          </div>

          {/* Main Dashboard Layout (4 Columns) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Right Column: Weekly Status & Messages */}
            <div className="flex flex-col space-y-6">
              
              {/* Weekly Status Card */}
              <div className="bg-primary-blue rounded-xl p-6 text-white shadow-md flex flex-col relative overflow-hidden">
                 {/* Decorative accent */}
                 <div className="absolute top-0 right-0 w-32 h-32 bg-action-blue/20 rounded-full -translate-y-1/2 translate-x-1/3 blur-xl pointer-events-none"></div>
                 
                 <h3 className="text-lg font-bold mb-6 relative z-10">סטטוס שבועי</h3>
                 
                 <div className="space-y-6 relative z-10">
                   <div>
                     <p className="text-inverse-primary text-sm mb-1 font-medium">שבוע נוכחי</p>
                     <div className="flex items-end space-x-2 space-x-reverse">
                       <span className="text-3xl font-bold">4/5</span>
                       <span className="text-sm text-inverse-primary mb-1">משמרות</span>
                     </div>
                     {/* Progress bar */}
                     <div className="w-full bg-white/10 h-2 rounded-full mt-3 overflow-hidden">
                       <div className="bg-action-blue h-full rounded-full" style={{ width: '80%' }}></div>
                     </div>
                   </div>
                   
                   <div className="pt-5 border-t border-white/10">
                     <p className="text-inverse-primary text-sm mb-1 font-medium">שבוע הבא</p>
                     <p className="text-lg font-semibold text-white/80">טרם נקבע</p>
                   </div>
                 </div>
              </div>

              {/* Manager Messages */}
              <div className="bg-surface border border-outline/10 rounded-xl p-6 shadow-sm flex flex-col flex-1">
                <h3 className="text-lg font-bold text-primary-blue mb-5 flex items-center border-b border-outline/10 pb-4">
                  <Icon name="message-circle" size={20} className="ml-2 text-action-blue" />
                  הודעות מנהל
                </h3>
                
                <div className="space-y-4 flex-1 overflow-y-auto">
                  <div className="p-4 bg-neutral-gray rounded-xl border-r-4 border-r-action-blue">
                    <h4 className="text-sm font-bold text-primary-blue mb-1">שינוי בנהלי פתיחה</h4>
                    <p className="text-xs text-text-primary leading-relaxed">שימו לב, החל מיום ראשון הקרוב נהלי הפתיחה...</p>
                  </div>
                  <div className="p-4 bg-neutral-gray rounded-xl border-r-4 border-r-primary-blue">
                    <h4 className="text-sm font-bold text-primary-blue mb-1">ישיבת צוות חודשית</h4>
                    <p className="text-xs text-text-primary leading-relaxed">מוזמנים לישיבה ביום רביעי בשעה 16:00 בחדר הישיבות</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Center Columns: Weekly Shifts */}
            <div className="lg:col-span-2 bg-surface border border-outline/10 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-primary-blue">משמרות השבוע</h3>
              </div>

              {/* Days Header */}
              <div className="grid grid-cols-7 gap-2 mb-4 text-center border-b border-outline/10 pb-3">
                {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((day, idx) => (
                  <div key={idx} className="text-sm font-bold text-text-primary/70">{day}</div>
                ))}
              </div>

              {/* Shift List Details */}
              <div className="space-y-3">
                <div className="flex items-center p-4 bg-neutral-gray rounded-xl border border-outline/5 hover:border-action-blue/30 transition-colors">
                   <div className="w-12 text-center text-xl font-bold text-action-blue border-l border-outline/10 pl-4 ml-4">
                     א'
                   </div>
                   <div className="flex-1">
                     <p className="font-bold text-primary-blue">משמרת בוקר</p>
                     <p className="text-sm text-text-primary/80">08:00 - 16:00 | סניף מרכז</p>
                   </div>
                   <button className="text-action-blue hover:text-primary-blue transition-colors p-2 bg-surface rounded-md border border-outline/10">
                     <Icon name="info" size={18} />
                   </button>
                </div>
                
                <div className="flex items-center p-4 bg-primary-blue rounded-xl border border-primary-blue shadow-md">
                   <div className="w-12 text-center text-xl font-bold text-inverse-primary border-l border-white/20 pl-4 ml-4">
                     ב'
                   </div>
                   <div className="flex-1">
                     <p className="font-bold text-white">משמרת לילה</p>
                     <p className="text-sm text-white/80">22:00 - 06:00 | סניף מרכז</p>
                   </div>
                   <button className="text-white hover:text-inverse-primary transition-colors p-2 bg-white/10 rounded-md border border-white/20">
                     <Icon name="info" size={18} />
                   </button>
                </div>
              </div>
            </div>

            {/* Left Column: Quick Actions */}
            <div className="bg-surface border border-outline/10 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-primary-blue mb-5">פעולות מהירות</h3>
              <div className="flex flex-col space-y-4">
                <div className="flex items-center p-4 bg-neutral-gray rounded-xl border border-outline/10 cursor-pointer hover:border-action-blue transition-colors group">
                   <div className="w-12 h-12 bg-surface rounded-xl flex items-center justify-center text-action-blue ml-4 shadow-sm group-hover:bg-action-blue group-hover:text-white transition-colors">
                     <Icon name="calendar" size={20} />
                   </div>
                   <div>
                     <h4 className="font-bold text-primary-blue">אירועי השבוע</h4>
                     <p className="text-xs text-text-primary">יום גיבוש צוותי ביום ה'</p>
                   </div>
                </div>
                <div className="flex items-center p-4 bg-neutral-gray rounded-xl border border-outline/10 cursor-pointer hover:border-action-blue transition-colors group">
                   <div className="w-12 h-12 bg-surface rounded-xl flex items-center justify-center text-action-blue ml-4 shadow-sm group-hover:bg-action-blue group-hover:text-white transition-colors">
                     <Icon name="refresh-cw" size={20} />
                   </div>
                   <div>
                     <h4 className="font-bold text-primary-blue">החלפת משמרת</h4>
                     <p className="text-xs text-text-primary">הגש בקשה להחלפה</p>
                   </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </main>

    </div>
  );
}

