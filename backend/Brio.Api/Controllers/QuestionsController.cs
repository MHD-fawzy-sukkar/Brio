using Brio.Business.DTOs.QuestionDtos;
using Brio.Business.Forms.QuestionForms;
using Brio.Business.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Brio.Api.Controllers;

[Authorize]
public class QuestionsController : ApiControllerBase
{
    private readonly IQuestionService _questionService;

    public QuestionsController(IQuestionService questionService)
    {
        _questionService = questionService;
    }

    /// <summary>
    /// Creates a question inside a quiz.
    /// </summary>
    [HttpPost("/api/quizzes/{quizId:guid}/questions")]
    public async Task<ActionResult<QuestionDto>> Create(Guid quizId, [FromBody] CreateQuestionForm form, CancellationToken cancellationToken)
    {
        var created = await _questionService.CreateQuestionAsync(quizId, form, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    /// <summary>
    /// Retrieves all questions for a specific quiz.
    /// </summary>
    [HttpGet("/api/quizzes/{quizId:guid}/questions")]
    public async Task<ActionResult<IReadOnlyList<QuestionDto>>> GetByQuizId(Guid quizId, CancellationToken cancellationToken)
    {
        var questions = await _questionService.GetQuestionsByQuizIdAsync(quizId, cancellationToken);
        return Ok(questions);
    }

    /// <summary>
    /// Retrieves a question by ID.
    /// </summary>
    [HttpGet("/api/questions/{id:guid}")]
    public async Task<ActionResult<QuestionDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var question = await _questionService.GetQuestionByIdAsync(id, cancellationToken);
        return Ok(question);
    }

    /// <summary>
    /// Updates a question by ID.
    /// </summary>
    [HttpPut("/api/questions/{id:guid}")]
    public async Task<ActionResult<QuestionDto>> Update(Guid id, [FromBody] UpdateQuestionForm form, CancellationToken cancellationToken)
    {
        var updated = await _questionService.UpdateQuestionAsync(id, form, cancellationToken);
        return Ok(updated);
    }

    /// <summary>
    /// Deletes a question by ID.
    /// </summary>
    [HttpDelete("/api/questions/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await _questionService.DeleteQuestionAsync(id, cancellationToken);
        return NoContent();
    }
}
