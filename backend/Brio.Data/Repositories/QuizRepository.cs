using Brio.Data.Contexts;
using Brio.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Brio.Data.Repositories;

public class QuizRepository : Repository<Quiz>, IQuizRepository
{
    public QuizRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<Quiz?> GetWithQuestionsAndOptionsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(q => q.Questions.OrderBy(question => question.OrderIndex))
                .ThenInclude(q => q.Options)
            .Include(q => q.Creator)
            .FirstOrDefaultAsync(q => q.Id == id, cancellationToken);
    }
}
