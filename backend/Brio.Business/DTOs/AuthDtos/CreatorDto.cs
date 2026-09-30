namespace Brio.Business.DTOs.AuthDtos;

public record CreatorDto(
    Guid Id,
    string GoogleId,
    string Email,
    string DisplayName,
    DateTime CreatedAt
);
