# Brio - Project Structure Guidelines

## 1. Backend (ASP.NET Core - N-Tier Architecture)
The backend must be a single Solution (`Zync.sln`) containing exactly 4 distinct projects:
- **`Zync.Api`**: The entry point. Contains Controllers, Middlewares, HostedServices, and configuration (Program.cs)[cite: 1].
- **`Zync.Business`**: The core logic layer. Contains DTOs, Mappers, Services, Validations, and Enums[cite: 2]. This layer depends heavily on `Zync.Data`.
- **`Zync.Data`**: The data access layer. Contains Entity Framework Contexts, Entities, Migrations, and Repositories[cite: 2].
- **`Zync.Tests`**: Unit and Integration testing project targeting all layers[cite: 2].

*Rule: Strict dependency flow. API depends on Business. Business depends on Data.*

## 2. Frontend (Next.js PWA - Feature-Sliced Design)
The React/Next.js frontend must follow a feature-based structure:
- `src/components`: Shared UI components (Buttons, Inputs, Modals).
- `src/features`: Isolated feature modules (e.g., `quiz-builder`, `live-game`). Each contains its own UI, hooks, and local state.
- `src/services`: API client setup (Axios/Fetch) and endpoints mapping.
- `src/types`: TypeScript interfaces mirroring the C# DTOs.