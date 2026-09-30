using System.ComponentModel.DataAnnotations;
using Brio.Data.Entities;

namespace Brio.Business.Forms.QuestionForms;

public class CreateQuestionForm
{
    [Range(0, 1000, ErrorMessage = "Order index must be zero or positive.")]
    public int OrderIndex { get; set; }

    [Required(ErrorMessage = "Question text is required.")]
    [StringLength(500, ErrorMessage = "Question text cannot exceed 500 characters.")]
    public string Text { get; set; } = string.Empty;

    [Required]
    public QuestionType Type { get; set; }

    [StringLength(500, ErrorMessage = "Media URL cannot exceed 500 characters.")]
    public string? MediaUrl { get; set; }

    [Range(5, 300, ErrorMessage = "Time limit must be between 5 and 300 seconds.")]
    public int TimeLimit { get; set; } = 30;

    public PointsMultiplier PointsMultiplier { get; set; } = PointsMultiplier.Standard;

    public List<CreateQuestionOptionForm> Options { get; set; } = new();
}
