using Microsoft.AspNetCore.Mvc;

namespace Brio.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public abstract class ApiControllerBase : ControllerBase
{
}
