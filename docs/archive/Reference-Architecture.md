# Solution Reference Architecture & Blueprint

This document defines the strict reference architecture, project organization, structural folder responsibilities, file suffix conventions, cross-cutting patterns, and execution flow rules for this solution. It serves as an authoritative blueprint for maintaining architectural consistency or recreating a new solution adhering to the exact same architectural standards.

---

## 1. High-Level Architecture

The solution uses a **Layered Clean Architecture** variation built on **.NET 10** with explicit separation of concerns, strict dependency rules, convention-based Dependency Injection, and unified RFC 7807 error handling.

### Key Architectural Principles
- **Strict Dependency Direction:** `Hsms.Api` -> `Hsms.Business` -> `Hsms.Data`. Dependencies point inward. Higher layers depend on lower layers; data access never references higher layers.
- **Convention-Over-Configuration DI:** Dependency injection is orchestrated via **Autofac** modules utilizing load-bearing class suffixes (`*Controller`, `*Service`, `*Mapper`, `*Helper`, `*Repository`).
- **Decoupled Business Exception Model:** Business services never reference HTTP, `ControllerBase`, or MVC types. All business-rule and validation failures are communicated via strongly-typed `DomainException` derived types, which are intercepted by API pipeline middleware and translated into RFC 7807 `ProblemDetails`.
- **Manual Strongly-Typed Mapping:** Object mapping between layers (Forms/Queries <-> Entities <-> DTOs) is explicitly handled via manual, strongly-typed `*Mapper` classes registered with DI. Third-party mapping reflection libraries are deliberately avoided to maintain full type-safety and performance.
- **Stateless Read Queries & Tracking Control:** Read paths default to `AsNoTracking()` queries via `IRepository<T>.Query(tracking: false)`, while mutation paths explicitly load entities with change tracking.

```
       +-------------------------------------------------------+
       |                       Hsms.Api                        |
       |  (Controllers, Middleware, Auth Handlers, Startup)    |
       +---------------------------+---------------------------+
                                   |
                                   v
       +-------------------------------------------------------+
       |                     Hsms.Business                     |
       |  (Services, Mappers, Validations, DTOs, Forms, Sec)   |
       +---------------------------+---------------------------+
                                   |
                                   v
       +-------------------------------------------------------+
       |                       Hsms.Data                       |
       |  (EF Core Context, Repositories, Entities, Mapping)   |
       +-------------------------------------------------------+
```

---

## 2. File Suffix & Type Responsibility Matrix

Architectural responsibilities are strictly tied to load-bearing file suffixes. New implementations must follow these precise roles:

| Suffix / Type | Layer | Purpose & Architectural Responsibility |
| :--- | :--- | :--- |
| `*Controller.cs` | `Hsms.Api` | Web API endpoint definitions. Inherits from `ApiControllerBase`. Handles HTTP verb routing, request attribute validation, authorization policy execution, and delegates to services. Returns standard `ActionResult<T>`. |
| `*Form.cs` / `*Query.cs` | `Hsms.Business` | Input models and request command payloads passed into API endpoints and services. Decorated with DataAnnotations (`[Required]`, `[StringLength]`, custom attributes). |
| `*Dto.cs` | `Hsms.Business` | Data Transfer Objects representing structured, read-only response payloads sent back to HTTP clients. |
| `*Validator.cs` | `Hsms.Business` | Asynchronous business-rule and domain constraint validation logic. Checks database state prerequisites (e.g. existence checks) and throws `BusinessRuleException` with structured error dictionaries. |
| `*Mapper.cs` | `Hsms.Business` | Stateless manual mapping classes translating between Forms/Queries, Entities, and DTOs. Auto-registered in Autofac as concrete scoped services (`.AsSelf()`). |
| `*Service.cs` / `I*Service.cs` | `Hsms.Business` | Core business logic encapsulation. Manages transactional execution, orchestrates validation, mapping, and repository persistence operations. Auto-registered via interface conventions. |
| `*Repository.cs` / `I*Repository.cs` | `Hsms.Data` | Data access layer over Entity Framework Core `HsmsContext`. Inherits from `BaseRepository<T>` and encapsulates domain-specific EF Core queries (`Include`, `AsSplitQuery`, filters). |
| `*Map.cs` / `*Configuration.cs` | `Hsms.Data` | Entity Framework Core Fluent API table configurations implementing `IEntityTypeConfiguration<T>`. Defines primary keys, column properties, indexes, and entity relationships. |
| `*Module.cs` | All Layers | Autofac dependency injection container registration modules using assembly scanning based on load-bearing class suffixes. |
| `*Middleware.cs` | `Hsms.Api` | Custom ASP.NET Core request pipeline components handling cross-cutting concerns (exception-to-ProblemDetails translation, security claims enforcement). |
| `*Worker.cs` | `Hsms.Api` | `BackgroundService` implementations running periodic in-process background maintenance tasks. |
| `*Seeder.cs` | `Hsms.Api` | Startup data initialization classes populating mandatory database roles, administrative accounts, or initial environment records. |
| `*Tests.cs` | `Hsms.Tests` | xUnit test classes covering unit service logic, repository query accuracy, or full integration endpoints via `WebApplicationFactory`. |

---

## 3. Project & Folder Breakdown

### 3.1 `Hsms.Api` Project Structure
The API presentation layer built on ASP.NET Core Web API.

- **`Auth/`**
  - Security, authentication, and authorization pipeline components.
  - `ConfigureJwtBearerOptions.cs`: Configures JWT validation parameters (key, issuer, audience) dynamically from options.
  - `JwtValidationEvents.cs`: Event hook for post-token validation (checks JTI revocation list, active user status, and security stamp synchronization).
  - `PermissionAuthorization.cs`: Policy authorization requirement (`PermissionRequirement`), policy name definitions (`PermissionPolicies`), and live handler (`PermissionAuthorizationHandler`).
  - `HttpContextCurrentUserAccessor.cs`: Adapts ASP.NET Core `IHttpContextAccessor` to the Business layer's `ICurrentUserAccessor`.

- **`Autofac/`**
  - `ControllersModule.cs`: Autofac module registering all concrete `*Controller` types as `InstancePerLifetimeScope`.

- **`Common/`**
  - Infrastructure and utility helpers for API request parsing (e.g. `Sorting/SortParser.cs` for multi-field sort query string parsing).

- **`Configurations/`**
  - Strongly-typed POCO classes bound to configuration sections in `appsettings.json` (e.g. `AppSettings.cs`, `IdentitySettings.cs`).

- **`Controllers/`**
  - Web API controllers inheriting from `ApiControllerBase`. Exposes HTTP endpoints and authorization attributes.

- **`HostedServices/`**
  - Process-bound background workers (`TokenCleanupWorker.cs`, `NotificationCleanupWorker.cs`) executing scheduled maintenance operations.

- **`Middleware/`**
  - `ExceptionHandlingMiddleware.cs`: Intercepts unhandled and `DomainException` exceptions and converts them into standardized RFC 7807 `ProblemDetails`.
  - `MustChangePasswordMiddleware.cs`: Gates authenticated users marked with password reset flags from accessing protected endpoints until password change completes.

- **`Seeding/`**
  - Idempotent startup seeders (`IdentitySeeder.cs`, `TestDataSeeder.cs`, `InternalRequestSeeder.cs`, `DocumentActivitySeeder.cs`).

- **`Setup/`**
  - `ApiSetup.cs`: Composition root extension methods configuring Serilog, Autofac, Database DbContext, ASP.NET Core Identity, JWT authentication, CORS, rate limiting, controllers, Swagger, and health checks.

- **`Storage/`**
  - Root directory for physical application file uploads.

---

### 3.2 `Hsms.Business` Project Structure
The core domain logic and application workflow layer.

- **`Activity/` & `Services/Activity/`**
  - Specialized components for document activity logging, auditing, and visibility readers/writers.

- **`Assets/`**
  - Embedded static assets (e.g., logos, SVGs used for document generation).

- **`Autofac/`**
  - `ServicesModule.cs`: Autofac module auto-registering `*Service` (to interfaces), `*Mapper` (as concrete self), and `*Helper` (as self) types.

- **`Common/`**
  - Core cross-cutting domain abstractions, generic pagination models, and sorting models (e.g., `Sorting/SortOption.cs`).

- **`Configurations/`**
  - Strongly-typed configuration options used inside services (e.g. `JwtSettings.cs`, `SecuritySettings.cs`, `TokenCleanupSettings.cs`).

- **`DTOs/`**
  - Data Transfer Objects structured into domain subfolders (`Auth/`, `Inventory/`, `Deliveries/`, `Receivings/`, `Users/`, `Roles/`, `Activity/`, `Common/`).

- **`Enums/`**
  - Application-level business enums.

- **`Exports/`**
  - Report generators and document exporters (ClosedXML Excel reports, QuestPDF PDF document templates).

- **`Forms/`**
  - Input command objects and query parameter models categorized by domain (`AuthForms/`, `MaterialForms/`, `DeliveryForms/`, etc.).

- **`Helpers/`**
  - Common domain helper utilities (e.g. string formatting, cryptographic hashing).

- **`Mappers/`**
  - Strongly-typed, manual C# mapper classes (`MaterialMapper.cs`, `UserMapper.cs`, `DeliveryMapper.cs`).

- **`Security/`**
  - Authentication logic, JWT token generation (`TokenService.cs`), password validation (`PasswordReuseValidator.cs`), permission resolution (`PermissionResolver.cs`), and current user access abstractions (`ICurrentUserAccessor.cs`).

- **`Services/`**
  - Core business service implementations (`MaterialService.cs`, `UserService.cs`, `DeliveryService.cs`).

- **`Validations/`**
  - `DomainExceptions.cs`: Domain exception hierarchy (`NotFoundException`, `ConflictException`, `BusinessRuleException`, `ForbiddenException`, `AuthenticationFailedException`) and `ErrorCodes` registry.
  - Custom DataAnnotation attributes (`NotWhiteSpaceAttribute`, `FutureDateAttribute`, `IsValidEmail`).
  - Domain validation helpers and domain validators (`*Validator.cs`).

---

### 3.3 `Hsms.Data` Project Structure
The data persistence layer built on Entity Framework Core and SQL Server.

- **`Autofac/`**
  - `RepositoriesModule.cs`: Autofac module registering open generic `IRepository<>` to `BaseRepository<>` and concrete `*Repository` classes to their implemented interfaces.

- **`Contexts/`**
  - `HsmsContext.cs`: Entity Framework Core DbContext managing entity sets, database transactions, and model configurations.
  - `ClassMapping/`: Entity mapping configurations (`IEntityTypeConfiguration<T>`) defining database schema specifics, constraints, and indexes (`MaterialConfiguration.cs`, `UserMap.cs`, `DeliveryMap.cs`).

- **`Entities/`**
  - Entity models structured by domain domain groupings (`Identities/`, `Inventory/`, `Deliveries/`, `Receivings/`, `Requests/`, `Signature/`).

- **`Enums/`**
  - Database-mapped enums stored as values or strings in database tables.

- **`Filters/`**
  - Filter criteria parameter objects used by repository query methods (`MaterialListFilters.cs`, `DeliveryQueryFilter.cs`).

- **`Migrations/`**
  - EF Core code-first database migration files and `HsmsContextModelSnapshot.cs`.

- **`Repositories/`**
  - `_BaseRepository.cs`: Generic repository interface `IRepository<T>` and implementation `BaseRepository<T>`.
  - Concrete repositories (`MaterialRepository.cs`, `UserRepository.cs`, `DeliveryRepository.cs`) exposing specialized optimized EF Core queries.

---

### 3.4 `Hsms.Tests` Project Structure
Automated unit and integration test suite built on xUnit.

- **`Dashboard/`**, **`Deliveries/`**, **`Services/`**
  - Focused domain test fixtures testing business logic and API endpoints.

- **`Helpers/`**
  - Test helper utilities (e.g. `FakeDbContextFactory.cs`).

- **`Infrastructure/`**
  - `HsmsWebApplicationFactory.cs`: Custom `WebApplicationFactory` configuring in-memory / isolated SQLite database testing host.
  - `IntegrationCollection.cs`: xUnit test collection definition for shared integration test contexts.
  - `TestDbSeeder.cs`, `TestClientExtensions.cs`: Utilities for populating test data and simulating HTTP requests with authentication headers.

---

## 4. Cross-Cutting Design Patterns & Rules

### 4.1 Dependency Injection Architecture
- **Framework:** Autofac integrated via `AutofacServiceProviderFactory` in `ApiSetup.cs`.
- **Registration Strategy:** Convention-based automatic registration modules per layer. Manual registration per individual class is strictly avoided.
  - `RepositoriesModule`: Automatically binds `*Repository` to `I*Repository` and `IRepository<T>` to `BaseRepository<T>`.
  - `ServicesModule`: Automatically binds `*Service` to `I*Service`, `*Mapper` as self, and `*Helper` as self.
  - `ControllersModule`: Automatically binds `*Controller` as `InstancePerLifetimeScope`.
- **Injection Rule:** Constructor injection ONLY. Property injection is forbidden.

```csharp
// Autofac convention registration rule example (ServicesModule)
builder.RegisterAssemblyTypes(assembly)
    .Where(t => t.Name.EndsWith("Service", StringComparison.Ordinal) && !t.IsAbstract)
    .AsImplementedInterfaces()
    .InstancePerLifetimeScope();
```

---

### 4.2 Error Handling & ProblemDetails Standard
- **Centralized Middleware:** All exceptions pass through `ExceptionHandlingMiddleware`.
- **Business Exception Safety:** Services throw `DomainException` derived exceptions (`NotFoundException`, `ConflictException`, `BusinessRuleException`, `ForbiddenException`, `AuthenticationFailedException`). Services never throw HTTP status responses directly.
- **Client Translation:** The middleware formats all exceptions into RFC 7807 `ProblemDetails` (`application/problem+json`) containing:
  - `status`: Matching HTTP status code (400, 401, 403, 404, 409, 500).
  - `code`: Stable, machine-readable string error code (e.g. `category.duplicate`, `inventory.insufficient_stock`).
  - `detail`: Human-readable English fallback message.
  - `errors`: Field-level error dictionary (for 400 validation failures).
- **500 Error Sanitization:** Unexpected exceptions are logged with full trace details via Serilog, while the HTTP client receives a sanitized error response in non-development environments.

```csharp
// ProblemDetails response structure emitted by ExceptionHandlingMiddleware
{
  "type": "https://httpstatuses.io/400",
  "title": "Validation failed",
  "status": 400,
  "detail": "The selected category does not exist.",
  "instance": "/api/materials",
  "code": "validation_failed",
  "errors": {
    "categoryId": [ "The selected category does not exist." ]
  }
}
```

---

### 4.3 Two-Tier Validation Strategy
Validation is strictly divided into two distinct tiers:

#### Tier 1: Input Syntax & Model State Validation
- Handled at the API entry point via DataAnnotations on `*Form.cs` and `*Query.cs` models (`[Required]`, `[StringLength]`, `[Range]`, `[EmailAddress]`, custom validation attributes like `NotWhiteSpaceAttribute`).
- Intercepted by custom `ApiBehaviorOptions.InvalidModelStateResponseFactory` in `ApiSetup.cs`.
- Model binding error keys are automatically formatted to `camelCase` to present a uniform payload to the frontend with code `validation_failed`.

#### Tier 2: Domain State & Business Rule Validation
- Executed inside the Business Layer before state changes occur, using `*Validator.cs` helpers or within `*Service.cs`.
- Checks asynchronous database state prerequisites (e.g. checking whether a foreign key entity exists, verifying stock balance sufficiency, validating state transitions).
- On failure, throws `BusinessRuleException` carrying structured field-level error messages.

```csharp
// Example Tier 2 Validator (MaterialValidator.cs)
public static async Task ValidateAsync(
    IMaterialRepository materials,
    int categoryId,
    int unitId,
    bool requiresExpiryDate,
    int? expiryAlertLeadTimeDays,
    CancellationToken ct)
{
    if (!await materials.CategoryExistsAsync(categoryId, ct))
    {
        throw new BusinessRuleException("The selected category does not exist.",
            new Dictionary<string, string[]> { ["categoryId"] = ["The selected category does not exist."] });
    }
}
```

---

### 4.4 Object Mapping Approach
- Mapping is performed using manual, strongly-typed `*Mapper.cs` classes registered as scoped services in Autofac.
- Mappers handle bi-directional conversions:
  - Input Forms/Queries -> EF Core Entities
  - EF Core Entities -> Response DTOs
  - Repository Search Models -> DTOs
- Benefits: Guarantees compile-time safety, seamless field transformations, zero hidden reflection overhead, and clear debugging step-through capability.

```csharp
// Example Mapper method (MaterialMapper.cs)
public Material Map(CreateMaterialForm request, string code, DateTime now) => new()
{
    Code = code,
    Name = request.Name.Trim(),
    CategoryId = request.CategoryId,
    UnitId = request.UnitId,
    MinimumQuantity = request.MinimumQuantity,
    IsActive = true,
    CreatedAt = now,
    UpdatedAt = now
};
```

---

### 4.5 Security & Authorization Architecture

#### 1. Authentication & JWT Validation Pipeline
- Stateless JWT Bearer authentication configured via `SetupJwtAuthentication()`.
- Enhanced validation hooks inside `JwtValidationEvents`:
  1. **Token Revocation:** Checks the `JTI` claim against `IRevokedTokenRepository` (allows immediate per-token invalidation on logout).
  2. **Active User State:** Verifies the user exists in database and `IsActive == true`.
  3. **SecurityStamp Synchronization:** Validates that the token's `SecurityStamp` claim matches the current user's security stamp in ASP.NET Core Identity. Any security stamp rotation (password change, role modification) immediately invalidates all active tokens.

#### 2. Fine-Grained Permission Authorization
- Route endpoints are protected using explicit policies: `[Authorize(Policy = PermissionPolicies.InventoryManage)]`.
- Policies map to permission keys defined in `Permissions.cs` with the format `perm:<key>`.
- Evaluated dynamically per request by `PermissionAuthorizationHandler` using `IPermissionResolver`, checking user role permissions live against database state so permission changes take effect immediately without requiring token re-issuance.

#### 3. Request Gating Middleware
- `MustChangePasswordMiddleware`: Intercepts authenticated requests carrying the `MustChangePassword` claim and restricts user access exclusively to password modification endpoints until updated.

#### 4. Current Principal Context Isolation
- Business logic accesses current user metadata through `ICurrentUserAccessor` implemented by `HttpContextCurrentUserAccessor` in the API layer, keeping the Business layer free of direct `HttpContext` dependencies.

---

## 5. End-to-End Request Flow Execution Blueprint

The sequence below illustrates the exact trace of a standard mutation request (e.g. `POST /api/materials` to create a new material record) through all layers of the solution:

```
[ Client Request ]
       |
       v
1. HTTP Request (POST /api/materials with JSON payload)
       |
       v
2. ASP.NET Core Middleware Pipeline
   ├── ExceptionHandlingMiddleware (catches any downstream exception)
   ├── RateLimitingMiddleware (verifies IP rate limit)
   ├── CorsMiddleware (applies CORS policy)
   ├── AuthenticationMiddleware (parses JWT token, triggers JwtValidationEvents)
   ├── AuthorizationMiddleware (evaluates PermissionPolicies via PermissionAuthorizationHandler)
   └── MustChangePasswordMiddleware (verifies password change status)
       |
       v
3. API Layer Controller Execution
   ├── Action method in MaterialsController (inherits ApiControllerBase)
   └── Model Binding & Tier 1 DataAnnotations Validation
       ├── IF Invalid -> InvalidModelStateResponseFactory produces 400 ProblemDetails (returns to client)
       └── IF Valid -> Controller invokes IMaterialService.CreateAsync(requestForm, ct)
       |
       v
4. Business Logic Service Execution
   ├── MaterialService receives CreateMaterialForm
   ├── Tier 2 Business Validation: Calls MaterialValidator.ValidateAsync(...)
   │   └── IF Validation fails -> Throws BusinessRuleException (intercepted by middleware)
   ├── Code Generation & Hashing: Generates material code / metadata
   ├── Entity Mapping: MaterialMapper.Map(requestForm, code, now) converts Form -> Material Entity
   └── Persistence Invocation: Calls IMaterialRepository.CreateAsync(materialEntity, ct)
       |
       v
5. Data Access Layer Execution
   ├── MaterialRepository (inherits BaseRepository<Material>)
   ├── Calls Set.AddAsync(materialEntity, ct)
   └── Calls Context.SaveChangesAsync(ct) -> EF Core executes SQL INSERT into SQL Server
       |
       v
6. Result Mapping & Response Creation
   ├── Service retrieves saved Entity and related navigation balances
   ├── MaterialMapper.Map(savedEntity, ...) maps Entity -> MaterialDetailDto
   └── Service returns MaterialDetailDto to MaterialsController
       |
       v
7. HTTP Response Serialization
   ├── Controller wraps result in CreatedAtAction(nameof(Get), new { id = created.Id }, created)
   └── HTTP 201 Created response sent to Client with JSON body
```

---

## 6. Architectural Rules for Code Generation

When writing or generating new features in this codebase, the following rules MUST be strictly followed:

1. **Naming Conventions:**
   - Controllers: `<Domain>Controller.cs` in `Hsms.Api/Controllers`
   - Forms/Queries: `<Action><Domain>Form.cs` or `<Domain>Query.cs` in `Hsms.Business/Forms/<Domain>`
   - DTOs: `<Domain>Dto.cs` or `<Domain><View>Dto.cs` in `Hsms.Business/DTOs/<Domain>`
   - Mappers: `<Domain>Mapper.cs` in `Hsms.Business/Mappers`
   - Services: `<Domain>Service.cs` and `I<Domain>Service.cs` in `Hsms.Business/Services`
   - Repositories: `<Domain>Repository.cs` and `I<Domain>Repository.cs` in `Hsms.Data/Repositories`
   - Entity Maps: `<Domain>Map.cs` or `<Domain>Configuration.cs` in `Hsms.Data/Contexts/ClassMapping`
2. **Layer Isolation:**
   - Never reference `Microsoft.AspNetCore.Mvc` or HTTP types in `Hsms.Business` or `Hsms.Data`.
   - Never reference EF Core `DbContext` directly inside Controllers; always go through Services.
3. **Error Reporting:**
   - Never return `BadRequest(string)` or custom error JSON from Controllers directly. Throw `DomainException` subtypes from services and allow `ExceptionHandlingMiddleware` to handle translation.
4. **Dependency Injection:**
   - Always rely on Autofac convention registration. Ensure file suffixes match convention rules (`*Service`, `*Mapper`, `*Repository`, `*Controller`) so DI registrations occur automatically.
