using System.Security.Claims;
using Brio.Business.Security;
using Brio.Business.Validations;

namespace Brio.Api.Auth;

public class HttpContextCurrentUserAccessor : ICurrentUserAccessor
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HttpContextCurrentUserAccessor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid GetCurrentUserId()
    {
        var httpContext = _httpContextAccessor.HttpContext;
        var user = httpContext?.User;

        if (user?.Identity != null && user.Identity.IsAuthenticated)
        {
            var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                              ?? user.FindFirst("sub")?.Value;

            if (Guid.TryParse(userIdClaim, out var userId))
            {
                return userId;
            }
        }

        // Support test header fallback in non-auth integration test scenarios
        if (httpContext?.Request.Headers.TryGetValue("X-Creator-Id", out var customHeaderVal) == true)
        {
            if (Guid.TryParse(customHeaderVal, out var headerGuid))
            {
                return headerGuid;
            }
        }

        throw new ForbiddenException("Authentication required. No valid user identity found.");
    }
}
