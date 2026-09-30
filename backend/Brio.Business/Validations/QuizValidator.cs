using Brio.Data.Entities;

namespace Brio.Business.Validations;

public static class QuizValidator
{
    public static void ValidateOwnership(Quiz quiz, Guid currentUserId)
    {
        if (quiz.CreatorId != currentUserId)
        {
            throw new ForbiddenException($"You do not have permission to modify or delete Quiz '{quiz.Id}'.");
        }
    }
}
