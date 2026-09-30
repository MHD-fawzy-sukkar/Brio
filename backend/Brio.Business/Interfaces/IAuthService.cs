using Brio.Business.DTOs.AuthDtos;
using Brio.Business.Forms.AuthForms;

namespace Brio.Business.Interfaces;

public interface IAuthService
{
    Task<AuthResponseDto> AuthenticateGoogleUserAsync(GoogleAuthForm form, CancellationToken cancellationToken = default);
}
