using Brio.Business.DTOs.QuizDtos;
using Brio.Business.Forms.QuizForms;

namespace Brio.Business.Interfaces;

public interface IQuizService
{
    Task<QuizDetailDto> CreateQuizAsync(CreateQuizForm form, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<QuizSummaryDto>> GetAllQuizzesAsync(CancellationToken cancellationToken = default);
    Task<QuizDetailDto> GetQuizByIdAsync(Guid quizId, CancellationToken cancellationToken = default);
    Task<QuizDetailDto> UpdateQuizAsync(Guid quizId, UpdateQuizForm form, CancellationToken cancellationToken = default);
    Task DeleteQuizAsync(Guid quizId, CancellationToken cancellationToken = default);
}
