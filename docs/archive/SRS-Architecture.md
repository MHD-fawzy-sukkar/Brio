# Brio - Real-Time Gamified Quiz Platform
## System Architecture & Requirements

**1. Tech Stack**
- Backend: ASP.NET Core Web API (.NET 8/9), Entity Framework Core.
- Frontend: Next.js (React), Tailwind CSS, Framer Motion (PWA enabled).
- Database: SQL Server or MySQL (for permanent data).
- Real-time Engine: SignalR & Redis (for in-memory game state and leaderboards).
- Media Storage: Cloudinary (via API, store URLs only in DB).

**2. Core Features (Sprint 1 - Quiz Builder)**
- Google OAuth for Creator login.
- Quizzes contain: Title, Cover Image, and Questions.
- Question Types: Multiple Choice (4 options), True/False, Short Answer, Poll.
- Media: Questions can have an attached image/video URL.
- Offline/Resilience: Frontend PWA must pre-fetch media assets before live game starts.

**3. Vibe & UI/UX**
- E-sports/Competitive theme with Neon glow.
- Mascot: "Bolt" (Overclocked Robot) that reacts to game states (timer running out, correct/wrong answers).
- Animations: Framer Motion for smooth transitions.