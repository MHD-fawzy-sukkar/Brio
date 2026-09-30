using Brio.Business.DTOs.QuestionDtos;
using Brio.Business.Forms.QuestionForms;
using Brio.Business.Interfaces;
using Brio.Business.Mappers;
using Brio.Business.Security;
using Brio.Business.Validations;
using Brio.Data.Repositories;

namespace Brio.Business.Services;

public class QuestionService : IQuestionService
{
    private readonly IQuizRepository _quizRepository;
    private readonly IQuestionRepository _questionRepository;
    private readonly QuestionMapper _questionMapper;
    private readonly ICurrentUserAccessor _currentUserAccessor;

    public QuestionService(
        IQuizRepository quizRepository,
        IQuestionRepository questionRepository,
        QuestionMapper questionMapper,
        ICurrentUserAccessor currentUserAccessor)
    {
        _quizRepository = quizRepository;
        _questionRepository = questionRepository;
        _questionMapper = questionMapper;
        _currentUserAccessor = currentUserAccessor;
    }

    public async Task<QuestionDto> CreateQuestionAsync(Guid quizId, CreateQuestionForm form, CancellationToken cancellationToken = default)
    {
        var quiz = await _quizRepository.GetByIdAsync(quizId, cancellationToken);
        if (quiz == null)
        {
            throw new NotFoundException($"Quiz with ID '{quizId}' was not found.");
        }

        var currentUserId = _currentUserAccessor.GetCurrentUserId();
        QuizValidator.ValidateOwnership(quiz, currentUserId);
        QuestionValidator.ValidateQuestionForm(form);

        var question = _questionMapper.MapToEntity(form, quizId);
        await _questionRepository.AddAsync(question, cancellationToken);

        quiz.UpdatedAt = DateTime.UtcNow;
        _quizRepository.Update(quiz);

        await _questionRepository.SaveChangesAsync(cancellationToken);
        return _questionMapper.MapToDto(question);
    }

    public async Task<IReadOnlyList<QuestionDto>> GetQuestionsByQuizIdAsync(Guid quizId, CancellationToken cancellationToken = default)
    {
        var quiz = await _quizRepository.GetByIdAsync(quizId, cancellationToken);
        if (quiz == null)
        {
            throw new NotFoundException($"Quiz with ID '{quizId}' was not found.");
        }

        var questions = await _questionRepository.GetByQuizIdAsync(quizId, cancellationToken);
        return questions.Select(_questionMapper.MapToDto).ToList();
    }

    public async Task<QuestionDto> GetQuestionByIdAsync(Guid questionId, CancellationToken cancellationToken = default)
    {
        var question = await _questionRepository.GetWithOptionsAsync(questionId, cancellationToken);
        if (question == null)
        {
            throw new NotFoundException($"Question with ID '{questionId}' was not found.");
        }

        return _questionMapper.MapToDto(question);
    }

    public async Task<QuestionDto> UpdateQuestionAsync(Guid questionId, UpdateQuestionForm form, CancellationToken cancellationToken = default)
    {
        var question = await _questionRepository.GetWithOptionsAsync(questionId, cancellationToken);
        if (question == null)
        {
            throw new NotFoundException($"Question with ID '{questionId}' was not found.");
        }

        var currentUserId = _currentUserAccessor.GetCurrentUserId();
        if (question.Quiz != null)
        {
            QuizValidator.ValidateOwnership(question.Quiz, currentUserId);
        }
        else
        {
            var quiz = await _quizRepository.GetByIdAsync(question.QuizId, cancellationToken);
            if (quiz != null)
            {
                QuizValidator.ValidateOwnership(quiz, currentUserId);
            }
        }

        _questionMapper.UpdateEntity(question, form);
        _questionRepository.Update(question);

        if (question.Quiz != null)
        {
            question.Quiz.UpdatedAt = DateTime.UtcNow;
            _quizRepository.Update(question.Quiz);
        }

        await _questionRepository.SaveChangesAsync(cancellationToken);
        return _questionMapper.MapToDto(question);
    }

    public async Task DeleteQuestionAsync(Guid questionId, CancellationToken cancellationToken = default)
    {
        var question = await _questionRepository.GetWithOptionsAsync(questionId, cancellationToken);
        if (question == null)
        {
            throw new NotFoundException($"Question with ID '{questionId}' was not found.");
        }

        var currentUserId = _currentUserAccessor.GetCurrentUserId();
        if (question.Quiz != null)
        {
            QuizValidator.ValidateOwnership(question.Quiz, currentUserId);
        }
        else
        {
            var quiz = await _quizRepository.GetByIdAsync(question.QuizId, cancellationToken);
            if (quiz != null)
            {
                QuizValidator.ValidateOwnership(quiz, currentUserId);
            }
        }

        _questionRepository.Delete(question);
        await _questionRepository.SaveChangesAsync(cancellationToken);
    }
}
