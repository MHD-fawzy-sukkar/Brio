using Brio.Data.Entities;

namespace Brio.Business.DTOs;

public record CreateQuestionDto(
    int OrderIndex,
    string Text,
    QuestionType Type,
    string? MediaUrl,
    int TimeLimit,
    PointsMultiplier PointsMultiplier,
    List<CreateQuestionOptionDto> Options
);
