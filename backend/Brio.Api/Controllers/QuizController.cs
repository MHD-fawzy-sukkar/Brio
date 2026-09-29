using Brio.Business.DTOs;
using Brio.Business.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Brio.Api.Controllers;

[ApiController]
[Route("api/quizzes")]
public class QuizController : ControllerBase
{
    private readonly IQuizService _quizService;

    public QuizController(IQuizService quizService)
    {
        _quizService = quizService;
    }

    /// <summary>
    /// Creates a new Quiz.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<QuizDetailDto>> CreateQuiz([FromBody] CreateQuizDto dto, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var createdQuiz = await _quizService.CreateQuizAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetQuizById), new { quizId = createdQuiz.Id }, createdQuiz);
    }

    /// <summary>
    /// Adds a question to an existing Quiz.
    /// </summary>
    [HttpPost("{quizId:guid}/questions")]
    public async Task<ActionResult<QuestionDto>> AddQuestion(Guid quizId, [FromBody] CreateQuestionDto dto, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var question = await _quizService.AddQuestionToQuizAsync(quizId, dto, cancellationToken);
            return CreatedAtAction(nameof(GetQuizById), new { quizId }, question);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Retrieves full quiz details by ID.
    /// </summary>
    [HttpGet("{quizId:guid}")]
    public async Task<ActionResult<QuizDetailDto>> GetQuizById(Guid quizId, CancellationToken cancellationToken)
    {
        var quiz = await _quizService.GetQuizByIdAsync(quizId, cancellationToken);
        if (quiz == null)
        {
            return NotFound(new { message = $"Quiz with ID '{quizId}' was not found." });
        }

        return Ok(quiz);
    }
}
