using Brio.Data.Entities;

namespace Brio.Data.Repositories;

public interface IQuizRepository : IRepository<Quiz>
{
    Task<Quiz?> GetWithQuestionsAndOptionsAsync(Guid id, CancellationToken cancellationToken = default);
}
