using System.Text.Json;
using Brio.Business.Validations;
using Microsoft.AspNetCore.Mvc;

namespace Brio.Api.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (DomainException ex)
        {
            _logger.LogWarning(ex, "Domain exception caught by middleware: {Message}", ex.Message);
            await HandleDomainExceptionAsync(context, ex);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception caught by middleware.");
            await HandleUnhandledExceptionAsync(context, ex);
        }
    }

    private static async Task HandleDomainExceptionAsync(HttpContext context, DomainException ex)
    {
        context.Response.ContentType = "application/problem+json";
        context.Response.StatusCode = ex.StatusCode;

        var problemDetails = new ProblemDetails
        {
            Type = $"https://httpstatuses.io/{ex.StatusCode}",
            Title = GetTitleForStatusCode(ex.StatusCode),
            Status = ex.StatusCode,
            Detail = ex.Message,
            Instance = context.Request.Path
        };

        problemDetails.Extensions["code"] = ex.Code;
        if (ex.Errors != null && ex.Errors.Count > 0)
        {
            problemDetails.Extensions["errors"] = ex.Errors;
        }

        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        await context.Response.WriteAsync(JsonSerializer.Serialize(problemDetails, jsonOptions));
    }

    private static async Task HandleUnhandledExceptionAsync(HttpContext context, Exception ex)
    {
        context.Response.ContentType = "application/problem+json";
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;

        var problemDetails = new ProblemDetails
        {
            Type = "https://httpstatuses.io/500",
            Title = "An unexpected error occurred",
            Status = StatusCodes.Status500InternalServerError,
            Detail = ex.Message,
            Instance = context.Request.Path
        };
        problemDetails.Extensions["code"] = "internal_server_error";

        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        await context.Response.WriteAsync(JsonSerializer.Serialize(problemDetails, jsonOptions));
    }

    private static string GetTitleForStatusCode(int statusCode) => statusCode switch
    {
        400 => "Validation failed",
        403 => "Forbidden",
        404 => "Resource not found",
        409 => "Conflict",
        _ => "An error occurred"
    };
}
