# Shift Scheduler

A modern, scalable shift scheduling application built with React, TypeScript, and Firebase. This tool allows managers and administrators to view, create, edit, and manage employee shifts dynamically with real-time updates.

## 🚀 Technologies

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS, PostCSS (with RTL logical properties)
- **State & Data:** Custom React Hooks, Firebase Firestore (Real-time `onSnapshot`)
- **Forms & Validation:** React Hook Form, Zod
- **Routing:** React Router DOM
- **Internationalization (i18n):** Native Context API with Strategy Pattern
- **Date Utilities:** date-fns

## 📦 Features

- **Algorithmic Scheduling Engine:** Automatically generates optimal weekly drafts balancing employee constraints, target shifts, and shift coverage requirements.
- **Internationalization (i18n) & RTL:** Full support for Hebrew (RTL) and English (LTR) via a dynamic strategy pattern implementation, accessible from a global language switcher.
- **Real-Time Dashboard:** View real-time assigned shifts in a weekly calendar layout decoupled smoothly by Employee and Date.
- **Dynamic Data Mocking:** Fast iteration using our built-in Firestore Mock Seed functionality.
- **Shift Management:** Add, edit, and delete employee shifts with powerful form validations and instant visual feedback (Toasts).
- **Employee Preferences:** Define strict roles, target shifts, and complex daily constraints (time-based and preference-based) using dynamic schema validations.
- **Responsive Layout:** Clean, professional interface leveraging tailored CSS properties spanning mobile and desktop viewports.
- **Testing Infrastructure:** High-coverage unit test suites spanning the application using Vitest and React Testing Library.

## 🛠 Project Structure

The codebase is organized adopting a feature-sliced architecture for optimal scalability:

- `src/features/` - Encapsulated domain areas (`auth`, `shifts`, `team`)
- `src/components/` - Global, reusable UI components (`Layout`, atomics)
- `src/hooks/` - Global shared React hooks
- `src/lib/` - Third-party library initializations (e.g., Firebase)
- `src/pages/` - Top-level route components
- `src/types/` - Shared TypeScript interfaces and definitions

## ⚙️ Setup & Installation

**1. Clone the repository**

```bash
git clone <your-repo-url>
cd ShiftScheduler
```

**2. Install dependencies**

```bash
npm install
```

**3. Environment Configuration**
Create a `.env` file in the root directory and add your Firebase configurations:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

**4. Start the development server**

```bash
npm run dev
```

## 🔒 Security Practices

- Development environment variables (`.env`, `.env.local`) are excluded from source control.
- Firestore Security Rules must be applied via Google Cloud Console or Firebase CLI to enforce granular Read/Write access limits preventing unauthorized access.

## 🤝 Contributing

We follow **Conventional Commits** for commit messages.

- `feat:` for new features
- `fix:` for bug fixes
- `refactor:` for code architecture updates
- `chore:` for tooling and dependency changes

## 🎓 Acknowledgements & Credits

Special thanks and credit to **the mathematicians** for the architectural foundation, algorithm testing, shift constraints architecture, and the comprehensive data schemas that power the intelligent scheduling capabilities of this application. Their rigorous testing and mathematical modeling ensures our features are robust and performant edge-to-edge.
