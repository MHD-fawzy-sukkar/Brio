using Brio.Business.DTOs;

namespace Brio.Business.Interfaces;

public interface IQuizService
{
    Task<QuizDetailDto> CreateQuizAsync(CreateQuizDto dto, CancellationToken cancellationToken = default);
    Task<QuestionDto> AddQuestionToQuizAsync(Guid quizId, CreateQuestionDto dto, CancellationToken cancellationToken = default);
    Task<QuizDetailDto?> GetQuizByIdAsync(Guid quizId, CancellationToken cancellationToken = default);
}
