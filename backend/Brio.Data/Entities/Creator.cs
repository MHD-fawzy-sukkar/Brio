namespace Brio.Data.Entities;

public class Creator
{
    public Guid Id { get; set; }
    public string GoogleId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public ICollection<Quiz> Quizzes { get; set; } = new List<Quiz>();
}
