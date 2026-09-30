using Brio.Business.DTOs.QuestionDtos;

namespace Brio.Business.DTOs.QuizDtos;

public record QuizDetailDto(
    Guid Id,
    Guid CreatorId,
    string CreatorName,
    string Title,
    string? Description,
    string? CoverImageUrl,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    IReadOnlyList<QuestionDto> Questions
);
