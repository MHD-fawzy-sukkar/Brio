using Brio.Data.Contexts;
using Brio.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Brio.Data.Repositories;

public class QuestionRepository : Repository<Question>, IQuestionRepository
{
    public QuestionRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<Question?> GetWithOptionsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(q => q.Options)
            .Include(q => q.Quiz)
            .FirstOrDefaultAsync(q => q.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<Question>> GetByQuizIdAsync(Guid quizId, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(q => q.Options)
            .Where(q => q.QuizId == quizId)
            .OrderBy(q => q.OrderIndex)
            .ToListAsync(cancellationToken);
    }
}
