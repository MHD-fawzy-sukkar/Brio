namespace Brio.Business.DTOs;

public record QuizDetailDto(
    Guid Id,
    Guid CreatorId,
    string CreatorName,
    string Title,
    string? Description,
    string? CoverImageUrl,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    List<QuestionDto> Questions
);
