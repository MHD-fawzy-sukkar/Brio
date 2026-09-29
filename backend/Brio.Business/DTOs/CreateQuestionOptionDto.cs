namespace Brio.Business.DTOs;

public record CreateQuestionOptionDto(
    string Text,
    string? ImageUrl,
    bool IsCorrect
);
