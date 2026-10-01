# Database Schema (EF Core Code-First)

## SQL Database (Permanent Storage)
1. **Creator:** `Id` (GUID), `GoogleId`, `Email`, `DisplayName`, `CreatedAt`
2. **Quiz:** `Id` (GUID), `CreatorId` (FK), `Title`, `Description`, `CoverImageUrl`, `CreatedAt`, `UpdatedAt`
3. **Question:** `Id` (GUID), `QuizId` (FK), `OrderIndex`, `Text`, `Type` (Enum: MultipleChoice, TrueFalse, ShortAnswer, Poll), `MediaUrl`, `TimeLimit` (Seconds), `PointsMultiplier` (Enum: Standard, Double, Zero)
4. **QuestionOption:** `Id` (GUID), `QuestionId` (FK), `Text` (Holds option text or the exact correct word for ShortAnswer), `ImageUrl`, `IsCorrect` (Bool)

## Redis (In-Memory Live Game State)
*No live game actions hit the SQL database to ensure zero latency.*
- `Session:{PinCode}` -> QuizId, CurrentState (Lobby, Question_X, Leaderboard).
- `Session:{PinCode}:Players` -> List of objects { Nickname, AvatarId, CurrentScore }.
- `Session:{PinCode}:Question:{Id}:Answers` -> Client-side Timestamps for score calculation.