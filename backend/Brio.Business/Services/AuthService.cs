using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Brio.Business.Configurations;
using Brio.Business.DTOs.AuthDtos;
using Brio.Business.Forms.AuthForms;
using Brio.Business.Interfaces;
using Brio.Business.Validations;
using Brio.Data.Entities;
using Brio.Data.Repositories;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Brio.Business.Services;

public class AuthService : IAuthService
{
    private readonly IRepository<Creator> _creatorRepository;
    private readonly JwtSettings _jwtSettings;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IRepository<Creator> creatorRepository,
        IOptions<JwtSettings> jwtOptions,
        ILogger<AuthService> logger)
    {
        _creatorRepository = creatorRepository;
        _jwtSettings = jwtOptions.Value;
        _logger = logger;
    }

    public async Task<AuthResponseDto> AuthenticateGoogleUserAsync(GoogleAuthForm form, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(form.IdToken))
        {
            throw new BusinessRuleException("Google ID token is required.");
        }

        var googleUserInfo = ValidateAndParseGoogleTokenMock(form.IdToken);

        var existingCreators = await _creatorRepository.FindAsync(c => c.GoogleId == googleUserInfo.GoogleId, cancellationToken);
        var creator = existingCreators.FirstOrDefault();

        if (creator == null)
        {
            _logger.LogInformation("Registering new Creator from Google Auth. GoogleId: {GoogleId}", googleUserInfo.GoogleId);
            creator = new Creator
            {
                Id = Guid.NewGuid(),
                GoogleId = googleUserInfo.GoogleId,
                Email = googleUserInfo.Email,
                DisplayName = googleUserInfo.DisplayName,
                CreatedAt = DateTime.UtcNow
            };

            await _creatorRepository.AddAsync(creator, cancellationToken);
            await _creatorRepository.SaveChangesAsync(cancellationToken);
        }

        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_jwtSettings.SecretKey);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, creator.Id.ToString()),
            new(ClaimTypes.Email, creator.Email),
            new(ClaimTypes.Name, creator.DisplayName),
            new("google_id", creator.GoogleId)
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationInMinutes),
            Issuer = _jwtSettings.Issuer,
            Audience = _jwtSettings.Audience,
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var accessToken = tokenHandler.WriteToken(token);

        var creatorDto = new CreatorDto(
            creator.Id,
            creator.GoogleId,
            creator.Email,
            creator.DisplayName,
            creator.CreatedAt
        );

        return new AuthResponseDto(
            accessToken,
            "Bearer",
            _jwtSettings.ExpirationInMinutes * 60,
            creatorDto
        );
    }

    private static (string GoogleId, string Email, string DisplayName) ValidateAndParseGoogleTokenMock(string idToken)
    {
        if (idToken.StartsWith("mock:", StringComparison.OrdinalIgnoreCase))
        {
            var parts = idToken.Split(':');
            var googleId = parts.Length > 1 && !string.IsNullOrWhiteSpace(parts[1]) ? parts[1] : "google-mock-id-12345";
            var email = parts.Length > 2 && !string.IsNullOrWhiteSpace(parts[2]) ? parts[2] : "creator@brio.com";
            var name = parts.Length > 3 && !string.IsNullOrWhiteSpace(parts[3]) ? parts[3] : "Brio Quiz Creator";
            return (googleId, email, name);
        }

        return ("google-mock-id-12345", "creator@brio.com", "Brio Quiz Creator");
    }
}
