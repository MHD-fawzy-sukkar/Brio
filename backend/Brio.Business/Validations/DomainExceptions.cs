namespace Brio.Business.Validations;

public abstract class DomainException : Exception
{
    public string Code { get; }
    public int StatusCode { get; }
    public IDictionary<string, string[]>? Errors { get; }

    protected DomainException(string message, string code, int statusCode, IDictionary<string, string[]>? errors = null)
        : base(message)
    {
        Code = code;
        StatusCode = statusCode;
        Errors = errors;
    }
}

public class NotFoundException : DomainException
{
    public NotFoundException(string message, string code = ErrorCodes.NotFound)
        : base(message, code, 404)
    {
    }
}

public class ForbiddenException : DomainException
{
    public ForbiddenException(string message = "You are not authorized to perform this operation on this resource.", string code = ErrorCodes.Forbidden)
        : base(message, code, 403)
    {
    }
}

public class BusinessRuleException : DomainException
{
    public BusinessRuleException(string message, IDictionary<string, string[]>? errors = null, string code = ErrorCodes.BusinessRuleViolation)
        : base(message, code, 400, errors)
    {
    }
}

public class ConflictException : DomainException
{
    public ConflictException(string message, string code = ErrorCodes.Conflict)
        : base(message, code, 409)
    {
    }
}

public static class ErrorCodes
{
    public const string NotFound = "resource_not_found";
    public const string Forbidden = "forbidden_access";
    public const string BusinessRuleViolation = "business_rule_violation";
    public const string Conflict = "resource_conflict";
    public const string ValidationFailed = "validation_failed";
}
