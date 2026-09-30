using Brio.Business.DTOs.QuestionDtos;
using Brio.Business.Extensions;
using Brio.Business.Forms.QuestionForms;
using Brio.Data.Entities;

namespace Brio.Business.Mappers;

public class QuestionMapper
{
    public Question MapToEntity(CreateQuestionForm form, Guid quizId)
    {
        var question = new Question
        {
            Id = Guid.NewGuid(),
            QuizId = quizId,
            OrderIndex = form.OrderIndex,
            Text = form.Text.Trim(),
            Type = form.Type,
            MediaUrl = form.MediaUrl?.Trim(),
            TimeLimit = form.TimeLimit,
            PointsMultiplier = form.PointsMultiplier
        };

        if (form.Options != null)
        {
            foreach (var optForm in form.Options)
            {
                string text = form.Type == QuestionType.ShortAnswer
                    ? optForm.Text.NormalizeShortAnswer()
                    : optForm.Text.Trim();

                question.Options.Add(new QuestionOption
                {
                    Id = Guid.NewGuid(),
                    QuestionId = question.Id,
                    Text = text,
                    ImageUrl = optForm.ImageUrl?.Trim(),
                    IsCorrect = optForm.IsCorrect
                });
            }
        }

        return question;
    }

    public void UpdateEntity(Question question, UpdateQuestionForm form)
    {
        question.OrderIndex = form.OrderIndex;
        question.Text = form.Text.Trim();
        question.Type = form.Type;
        question.MediaUrl = form.MediaUrl?.Trim();
        question.TimeLimit = form.TimeLimit;
        question.PointsMultiplier = form.PointsMultiplier;

        question.Options.Clear();
        if (form.Options != null)
        {
            foreach (var optForm in form.Options)
            {
                string text = form.Type == QuestionType.ShortAnswer
                    ? optForm.Text.NormalizeShortAnswer()
                    : optForm.Text.Trim();

                question.Options.Add(new QuestionOption
                {
                    Id = optForm.Id ?? Guid.NewGuid(),
                    QuestionId = question.Id,
                    Text = text,
                    ImageUrl = optForm.ImageUrl?.Trim(),
                    IsCorrect = optForm.IsCorrect
                });
            }
        }
    }

    public QuestionDto MapToDto(Question question)
    {
        var optionDtos = question.Options
            .Select(o => new QuestionOptionDto(
                o.Id,
                o.QuestionId,
                o.Text,
                o.ImageUrl,
                o.IsCorrect
            ))
            .ToList();

        return new QuestionDto(
            question.Id,
            question.QuizId,
            question.OrderIndex,
            question.Text,
            question.Type,
            question.MediaUrl,
            question.TimeLimit,
            question.PointsMultiplier,
            optionDtos
        );
    }
}
