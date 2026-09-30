using System.ComponentModel.DataAnnotations;

namespace Brio.Business.Forms.QuizForms;

public class UpdateQuizForm
{
    [Required(ErrorMessage = "Quiz title is required.")]
    [StringLength(200, ErrorMessage = "Quiz title cannot exceed 200 characters.")]
    public string Title { get; set; } = string.Empty;

    [StringLength(1000, ErrorMessage = "Description cannot exceed 1000 characters.")]
    public string? Description { get; set; }

    [StringLength(500, ErrorMessage = "Cover image URL cannot exceed 500 characters.")]
    public string? CoverImageUrl { get; set; }
}
