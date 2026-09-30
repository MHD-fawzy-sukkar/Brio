using System.ComponentModel.DataAnnotations;

namespace Brio.Business.Forms.QuestionForms;

public class UpdateQuestionOptionForm
{
    public Guid? Id { get; set; }

    [Required(ErrorMessage = "Option text is required.")]
    [StringLength(300, ErrorMessage = "Option text cannot exceed 300 characters.")]
    public string Text { get; set; } = string.Empty;

    [StringLength(500, ErrorMessage = "Image URL cannot exceed 500 characters.")]
    public string? ImageUrl { get; set; }

    public bool IsCorrect { get; set; }
}
