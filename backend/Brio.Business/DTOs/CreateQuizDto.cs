namespace Brio.Business.DTOs;

public record CreateQuizDto(
    Guid CreatorId,
    string Title,
    string? Description,
    string? CoverImageUrl,
    List<CreateQuestionDto>? Questions = null
);
