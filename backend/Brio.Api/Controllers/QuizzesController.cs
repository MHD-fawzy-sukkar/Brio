using Brio.Business.DTOs.QuizDtos;
using Brio.Business.Forms.QuizForms;
using Brio.Business.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Brio.Api.Controllers;

[Authorize]
[Route("api/quizzes")]
public class QuizzesController : ApiControllerBase
{
    private readonly IQuizService _quizService;

    public QuizzesController(IQuizService quizService)
    {
        _quizService = quizService;
    }

    /// <summary>
    /// Creates a new quiz.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<QuizDetailDto>> Create([FromBody] CreateQuizForm form, CancellationToken cancellationToken)
    {
        var created = await _quizService.CreateQuizAsync(form, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    /// <summary>
    /// Retrieves all quizzes.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<QuizSummaryDto>>> GetAll(CancellationToken cancellationToken)
    {
        var quizzes = await _quizService.GetAllQuizzesAsync(cancellationToken);
        return Ok(quizzes);
    }

    /// <summary>
    /// Retrieves full quiz details by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<QuizDetailDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var quiz = await _quizService.GetQuizByIdAsync(id, cancellationToken);
        return Ok(quiz);
    }

    /// <summary>
    /// Updates an existing quiz.
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<QuizDetailDto>> Update(Guid id, [FromBody] UpdateQuizForm form, CancellationToken cancellationToken)
    {
        var updated = await _quizService.UpdateQuizAsync(id, form, cancellationToken);
        return Ok(updated);
    }

    /// <summary>
    /// Deletes a quiz by ID.
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await _quizService.DeleteQuizAsync(id, cancellationToken);
        return NoContent();
    }
}
