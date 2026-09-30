using Brio.Data.Entities;

namespace Brio.Business.DTOs.QuestionDtos;

public record QuestionDto(
    Guid Id,
    Guid QuizId,
    int OrderIndex,
    string Text,
    QuestionType Type,
    string? MediaUrl,
    int TimeLimit,
    PointsMultiplier PointsMultiplier,
    IReadOnlyList<QuestionOptionDto> Options
);
