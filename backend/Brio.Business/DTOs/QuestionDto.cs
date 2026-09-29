using Brio.Data.Entities;

namespace Brio.Business.DTOs;

public record QuestionDto(
    Guid Id,
    Guid QuizId,
    int OrderIndex,
    string Text,
    QuestionType Type,
    string? MediaUrl,
    int TimeLimit,
    PointsMultiplier PointsMultiplier,
    List<QuestionOptionDto> Options
);
