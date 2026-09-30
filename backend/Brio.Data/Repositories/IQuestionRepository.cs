using Brio.Data.Entities;

namespace Brio.Data.Repositories;

public interface IQuestionRepository : IRepository<Question>
{
    Task<Question?> GetWithOptionsAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Question>> GetByQuizIdAsync(Guid quizId, CancellationToken cancellationToken = default);
}
