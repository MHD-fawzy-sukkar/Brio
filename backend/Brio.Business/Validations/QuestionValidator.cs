using Brio.Business.Forms.QuestionForms;
using Brio.Data.Entities;

namespace Brio.Business.Validations;

public static class QuestionValidator
{
    public static void ValidateQuestionForm(CreateQuestionForm form)
    {
        if (form.Type != QuestionType.Poll && (form.Options == null || form.Options.Count < 1))
        {
            throw new BusinessRuleException(
                "Questions (except Polls) must contain at least one option.",
                new Dictionary<string, string[]> { ["options"] = ["At least one option is required."] }
            );
        }

        if (form.Type == QuestionType.MultipleChoice || form.Type == QuestionType.TrueFalse)
        {
            if (form.Options != null && !form.Options.Any(o => o.IsCorrect))
            {
                throw new BusinessRuleException(
                    "Multiple choice and True/False questions must have at least one correct option.",
                    new Dictionary<string, string[]> { ["options"] = ["At least one correct option must be marked."] }
                );
            }
        }
    }
}
