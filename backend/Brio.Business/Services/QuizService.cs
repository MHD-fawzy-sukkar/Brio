using Brio.Business.DTOs.QuizDtos;
using Brio.Business.Forms.QuizForms;
using Brio.Business.Interfaces;
using Brio.Business.Mappers;
using Brio.Business.Security;
using Brio.Business.Validations;
using Brio.Data.Repositories;

namespace Brio.Business.Services;

public class QuizService : IQuizService
{
    private readonly IQuizRepository _quizRepository;
    private readonly QuizMapper _quizMapper;
    private readonly ICurrentUserAccessor _currentUserAccessor;

    public QuizService(
        IQuizRepository quizRepository,
        QuizMapper quizMapper,
        ICurrentUserAccessor currentUserAccessor)
    {
        _quizRepository = quizRepository;
        _quizMapper = quizMapper;
        _currentUserAccessor = currentUserAccessor;
    }

    public async Task<QuizDetailDto> CreateQuizAsync(CreateQuizForm form, CancellationToken cancellationToken = default)
    {
        var creatorId = form.CreatorId ?? _currentUserAccessor.GetCurrentUserId();
        var quiz = _quizMapper.MapToEntity(form, creatorId);

        await _quizRepository.AddAsync(quiz, cancellationToken);
        await _quizRepository.SaveChangesAsync(cancellationToken);

        var createdQuiz = await _quizRepository.GetWithQuestionsAndOptionsAsync(quiz.Id, cancellationToken);
        return _quizMapper.MapToDetailDto(createdQuiz ?? quiz);
    }

    public async Task<IReadOnlyList<QuizSummaryDto>> GetAllQuizzesAsync(CancellationToken cancellationToken = default)
    {
        var quizzes = await _quizRepository.GetAllAsync(cancellationToken);
        return quizzes.Select(_quizMapper.MapToSummaryDto).ToList();
    }

    public async Task<QuizDetailDto> GetQuizByIdAsync(Guid quizId, CancellationToken cancellationToken = default)
    {
        var quiz = await _quizRepository.GetWithQuestionsAndOptionsAsync(quizId, cancellationToken);
        if (quiz == null)
        {
            throw new NotFoundException($"Quiz with ID '{quizId}' was not found.");
        }

        return _quizMapper.MapToDetailDto(quiz);
    }

    public async Task<QuizDetailDto> UpdateQuizAsync(Guid quizId, UpdateQuizForm form, CancellationToken cancellationToken = default)
    {
        var quiz = await _quizRepository.GetWithQuestionsAndOptionsAsync(quizId, cancellationToken);
        if (quiz == null)
        {
            throw new NotFoundException($"Quiz with ID '{quizId}' was not found.");
        }

        var currentUserId = _currentUserAccessor.GetCurrentUserId();
        QuizValidator.ValidateOwnership(quiz, currentUserId);

        _quizMapper.UpdateEntity(quiz, form);
        _quizRepository.Update(quiz);
        await _quizRepository.SaveChangesAsync(cancellationToken);

        return _quizMapper.MapToDetailDto(quiz);
    }

    public async Task DeleteQuizAsync(Guid quizId, CancellationToken cancellationToken = default)
    {
        var quiz = await _quizRepository.GetByIdAsync(quizId, cancellationToken);
        if (quiz == null)
        {
            throw new NotFoundException($"Quiz with ID '{quizId}' was not found.");
        }

        var currentUserId = _currentUserAccessor.GetCurrentUserId();
        QuizValidator.ValidateOwnership(quiz, currentUserId);

        _quizRepository.Delete(quiz);
        await _quizRepository.SaveChangesAsync(cancellationToken);
    }
}
