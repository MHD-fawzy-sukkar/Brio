namespace Brio.Business.DTOs.AuthDtos;

public record AuthResponseDto(
    string AccessToken,
    string TokenType,
    int ExpiresInSeconds,
    CreatorDto User
);
