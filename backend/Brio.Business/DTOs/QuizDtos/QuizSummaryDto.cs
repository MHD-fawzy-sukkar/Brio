namespace Brio.Business.DTOs.QuizDtos;

public record QuizSummaryDto(
    Guid Id,
    Guid CreatorId,
    string CreatorName,
    string Title,
    string? Description,
    string? CoverImageUrl,
    int QuestionCount,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);
