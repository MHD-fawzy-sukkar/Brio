using Brio.Business.Security;

namespace Brio.Api.Auth;

public class HttpContextCurrentUserAccessor : ICurrentUserAccessor
{
    // Default mock CreatorId for current context
    public static readonly Guid DefaultMockCreatorId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    private readonly IHttpContextAccessor _httpContextAccessor;

    public HttpContextCurrentUserAccessor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid GetCurrentUserId()
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext != null && httpContext.Request.Headers.TryGetValue("X-Creator-Id", out var customHeaderVal))
        {
            if (Guid.TryParse(customHeaderVal, out var headerGuid))
            {
                return headerGuid;
            }
        }

        return DefaultMockCreatorId;
    }
}
