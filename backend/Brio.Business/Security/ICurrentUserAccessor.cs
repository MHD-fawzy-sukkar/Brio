namespace Brio.Business.Security;

public interface ICurrentUserAccessor
{
    Guid GetCurrentUserId();
}
