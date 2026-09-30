using Brio.Business.DTOs.QuestionDtos;
using Brio.Business.Forms.QuestionForms;

namespace Brio.Business.Interfaces;

public interface IQuestionService
{
    Task<QuestionDto> CreateQuestionAsync(Guid quizId, CreateQuestionForm form, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<QuestionDto>> GetQuestionsByQuizIdAsync(Guid quizId, CancellationToken cancellationToken = default);
    Task<QuestionDto> GetQuestionByIdAsync(Guid questionId, CancellationToken cancellationToken = default);
    Task<QuestionDto> UpdateQuestionAsync(Guid questionId, UpdateQuestionForm form, CancellationToken cancellationToken = default);
    Task DeleteQuestionAsync(Guid questionId, CancellationToken cancellationToken = default);
}
