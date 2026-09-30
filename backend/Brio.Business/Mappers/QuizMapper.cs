using Brio.Business.DTOs.QuizDtos;
using Brio.Business.Forms.QuizForms;
using Brio.Data.Entities;

namespace Brio.Business.Mappers;

public class QuizMapper
{
    private readonly QuestionMapper _questionMapper;

    public QuizMapper(QuestionMapper questionMapper)
    {
        _questionMapper = questionMapper;
    }

    public Quiz MapToEntity(CreateQuizForm form, Guid creatorId)
    {
        var quiz = new Quiz
        {
            Id = Guid.NewGuid(),
            CreatorId = creatorId,
            Title = form.Title.Trim(),
            Description = form.Description?.Trim(),
            CoverImageUrl = form.CoverImageUrl?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        if (form.Questions != null && form.Questions.Count > 0)
        {
            foreach (var qForm in form.Questions)
            {
                var question = _questionMapper.MapToEntity(qForm, quiz.Id);
                quiz.Questions.Add(question);
            }
        }

        return quiz;
    }

    public void UpdateEntity(Quiz quiz, UpdateQuizForm form)
    {
        quiz.Title = form.Title.Trim();
        quiz.Description = form.Description?.Trim();
        quiz.CoverImageUrl = form.CoverImageUrl?.Trim();
        quiz.UpdatedAt = DateTime.UtcNow;
    }

    public QuizDetailDto MapToDetailDto(Quiz quiz)
    {
        var questionDtos = quiz.Questions
            .OrderBy(q => q.OrderIndex)
            .Select(_questionMapper.MapToDto)
            .ToList();

        return new QuizDetailDto(
            quiz.Id,
            quiz.CreatorId,
            quiz.Creator?.DisplayName ?? string.Empty,
            quiz.Title,
            quiz.Description,
            quiz.CoverImageUrl,
            quiz.CreatedAt,
            quiz.UpdatedAt,
            questionDtos
        );
    }

    public QuizSummaryDto MapToSummaryDto(Quiz quiz)
    {
        return new QuizSummaryDto(
            quiz.Id,
            quiz.CreatorId,
            quiz.Creator?.DisplayName ?? string.Empty,
            quiz.Title,
            quiz.Description,
            quiz.CoverImageUrl,
            quiz.Questions.Count,
            quiz.CreatedAt,
            quiz.UpdatedAt
        );
    }
}
