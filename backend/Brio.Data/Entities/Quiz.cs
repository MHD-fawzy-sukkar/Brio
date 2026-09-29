namespace Brio.Data.Entities;

public class Quiz
{
    public Guid Id { get; set; }
    public Guid CreatorId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? CoverImageUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public Creator Creator { get; set; } = null!;
    public ICollection<Question> Questions { get; set; } = new List<Question>();
}
