# Coding Guidelines for Antigravity CLI

1. **Clean Architecture:** Strictly follow Clean Architecture in the ASP.NET Core backend (Core, Infrastructure, Application, API layers).
2. **Dependency Injection:** Use DI extensively.
3. **Short Answer Normalization:** For Short Answer validation, do NOT use AI. Implement a fast C# string extension method that trims spaces, converts to lowercase, and normalizes Arabic characters (e.g., أ,إ,آ -> ا).
4. **Types Consistency:** Ensure TypeScript interfaces in the Next.js frontend perfectly match the C# DTOs returned by the backend.
5. **No Placeholders:** Write complete, functional code. Do not leave "TODO" or placeholder logic for core CRUD operations.
