using Brio.Business.DTOs.AuthDtos;
using Brio.Business.Forms.AuthForms;
using Brio.Business.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Brio.Api.Controllers;

[Route("api/auth")]
public class AuthController : ApiControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    /// <summary>
    /// Authenticates a user using Google OAuth ID Token and returns a JWT access token.
    /// </summary>
    [HttpPost("google")]
    public async Task<ActionResult<AuthResponseDto>> GoogleAuth([FromBody] GoogleAuthForm form, CancellationToken cancellationToken)
    {
        var response = await _authService.AuthenticateGoogleUserAsync(form, cancellationToken);
        return Ok(response);
    }
}
