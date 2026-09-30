namespace Brio.Business.DTOs.QuestionDtos;

public record QuestionOptionDto(
    Guid Id,
    Guid QuestionId,
    string Text,
    string? ImageUrl,
    bool IsCorrect
);
