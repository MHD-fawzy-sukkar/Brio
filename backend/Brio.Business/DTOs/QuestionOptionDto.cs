namespace Brio.Business.DTOs;

public record QuestionOptionDto(
    Guid Id,
    Guid QuestionId,
    string Text,
    string? ImageUrl,
    bool IsCorrect
);
