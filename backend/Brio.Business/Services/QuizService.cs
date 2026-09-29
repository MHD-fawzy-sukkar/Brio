using Brio.Business.DTOs;
using Brio.Business.Extensions;
using Brio.Business.Interfaces;
using Brio.Data.Entities;
using Brio.Data.Repositories;

namespace Brio.Business.Services;

public class QuizService : IQuizService
{
    private readonly IQuizRepository _quizRepository;
    private readonly IRepository<Question> _questionRepository;

    public QuizService(IQuizRepository quizRepository, IRepository<Question> questionRepository)
    {
        _quizRepository = quizRepository;
        _questionRepository = questionRepository;
    }

    public async Task<QuizDetailDto> CreateQuizAsync(CreateQuizDto dto, CancellationToken cancellationToken = default)
    {
        var quiz = new Quiz
        {
            Id = Guid.NewGuid(),
            CreatorId = dto.CreatorId,
            Title = dto.Title.Trim(),
            Description = dto.Description?.Trim(),
            CoverImageUrl = dto.CoverImageUrl?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        if (dto.Questions != null && dto.Questions.Count > 0)
        {
            foreach (var qDto in dto.Questions)
            {
                var question = MapCreateQuestionDtoToEntity(quiz.Id, qDto);
                quiz.Questions.Add(question);
            }
        }

        await _quizRepository.AddAsync(quiz, cancellationToken);
        await _quizRepository.SaveChangesAsync(cancellationToken);

        var createdQuiz = await _quizRepository.GetWithQuestionsAndOptionsAsync(quiz.Id, cancellationToken);
        return MapToDetailDto(createdQuiz ?? quiz);
    }

    public async Task<QuestionDto> AddQuestionToQuizAsync(Guid quizId, CreateQuestionDto dto, CancellationToken cancellationToken = default)
    {
        var quiz = await _quizRepository.GetByIdAsync(quizId, cancellationToken);
        if (quiz == null)
        {
            throw new KeyNotFoundException($"Quiz with ID '{quizId}' was not found.");
        }

        var question = MapCreateQuestionDtoToEntity(quizId, dto);

        await _questionRepository.AddAsync(question, cancellationToken);
        
        quiz.UpdatedAt = DateTime.UtcNow;
        _quizRepository.Update(quiz);

        await _quizRepository.SaveChangesAsync(cancellationToken);

        return MapToQuestionDto(question);
    }

    public async Task<QuizDetailDto?> GetQuizByIdAsync(Guid quizId, CancellationToken cancellationToken = default)
    {
        var quiz = await _quizRepository.GetWithQuestionsAndOptionsAsync(quizId, cancellationToken);
        if (quiz == null)
        {
            return null;
        }

        return MapToDetailDto(quiz);
    }

    private static Question MapCreateQuestionDtoToEntity(Guid quizId, CreateQuestionDto dto)
    {
        var question = new Question
        {
            Id = Guid.NewGuid(),
            QuizId = quizId,
            OrderIndex = dto.OrderIndex,
            Text = dto.Text.Trim(),
            Type = dto.Type,
            MediaUrl = dto.MediaUrl?.Trim(),
            TimeLimit = dto.TimeLimit,
            PointsMultiplier = dto.PointsMultiplier
        };

        foreach (var optDto in dto.Options)
        {
            string text = dto.Type == QuestionType.ShortAnswer
                ? optDto.Text.NormalizeShortAnswer()
                : optDto.Text.Trim();

            question.Options.Add(new QuestionOption
            {
                Id = Guid.NewGuid(),
                QuestionId = question.Id,
                Text = text,
                ImageUrl = optDto.ImageUrl?.Trim(),
                IsCorrect = optDto.IsCorrect
            });
        }

        return question;
    }

    private static QuizDetailDto MapToDetailDto(Quiz quiz)
    {
        var questionDtos = quiz.Questions
            .OrderBy(q => q.OrderIndex)
            .Select(MapToQuestionDto)
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

    private static QuestionDto MapToQuestionDto(Question question)
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
