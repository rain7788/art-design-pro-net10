using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.OpenApi;
using SeaCode.Api.Hosting;
using SeaCode.Core.Services.Admin.System;
using SeaCode.Core.Workers;
using SeaCode.Domain.Constants;
using SeaCode.Infra.Common;
using SeaCode.Infra.Data;
using SeaCode.Infra.Framework;
using SeaCode.Infra.Framework.Jobs;
using SeaCode.Infra.Framework.Middlewares;
using SeaCode.Infra.Framework.Routes;
using SeaCode.Infra.Logging;
using Serilog;
using Serilog.Events;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SeaCode.Infra.Cache;
using ArtSwagger;

var builder = WebApplication.CreateBuilder(args);

// ========== 日志配置 ==========
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Logging.ClearProviders();
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("System", LogEventLevel.Warning)
    .WriteTo.Console()
    .WriteTo.DailyMySQL(connectionString!) // 按天分表写入 MySQL 数据库
    .CreateLogger();

builder.Host.UseSerilog();

// ========== 服务配置 ==========
var services = builder.Services;
var configuration = builder.Configuration;

// HttpContextAccessor（用于 DbContextPool 获取 RequestContext）
services.AddHttpContextAccessor();

// 请求上下文（Scoped）- 包含租户信息
services.AddScoped<RequestContext>();

// 数据库（使用连接池，通过 IHttpContextAccessor 延迟获取租户信息）
services.AddDbContextPool<GameDbContext>((sp, options) =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)))
        .UseSnakeCaseNamingConvention()
        .EnableSensitiveDataLogging(builder.Environment.IsDevelopment())
        .ConfigureWarnings(w => w.Ignore(CoreEventId.SensitiveDataLoggingEnabledWarning)));

// 数据库工厂（用于 Worker）
services.AddDbContextFactory<GameDbContext>((sp, options) =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)))
        .UseSnakeCaseNamingConvention());

// Redis + 雪花ID 初始化
var redisConnection = configuration.GetConnectionString("Redis");
if (!string.IsNullOrEmpty(redisConnection))
{
    Redis.Initialize(redisConnection);
    services.AddSingleton(_ => Redis.Client);

    SnowflakeIdGenerator.Initialize(Redis.Client);
    Log.Information("Redis 已初始化，雪花ID生成器已启用 (通过 Redis 分配 WorkerId)");
}
else
{
    var workerId = ushort.TryParse(Environment.GetEnvironmentVariable("SNOWFLAKE_WORKER_ID"), out var id) ? id : (ushort)1;
    SnowflakeIdGenerator.Initialize(workerId);
    Log.Warning("雪花ID生成器已初始化 (WorkerId={WorkerId}，无 Redis)", workerId);
}

services.AddMemoryCache();

// JSON 宽容配置
services.ConfigureHttpJsonOptions(JsonConfiguration.ConfigureJsonOptions);

// DailyWorker（用于后台任务）
services.AddTransient<DailyWorker>();

// 任务配置提供器
services.AddSingleton<ITaskConfigurationProvider, TaskConfiguration>();

// 自动注入带 [Service] 特性的服务
services.AutoDependencyInjection();

// 自动扫描并注册路由实现
services.AddApiRouters();

// 注册任务调度器
services.AddSingleton<ITaskScheduler, SeaCode.Infra.Framework.Jobs.TaskScheduler>();
services.AddHostedService(sp => (SeaCode.Infra.Framework.Jobs.TaskScheduler)sp.GetRequiredService<ITaskScheduler>());

// CORS 跨域配置
services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Swagger
services.AddEndpointsApiExplorer();
services.AddSwaggerGen(options =>
{
    options.SwaggerDoc(ApiGroups.Admin, new() { Title = "SeaCode 管理端 API", Version = "v1" });
    options.SwaggerDoc(ApiGroups.Game, new() { Title = "SeaCode 用户端 API", Version = "v1" });
    options.SwaggerDoc(ApiGroups.Common, new() { Title = "SeaCode 公共端 API", Version = "v1" });
    options.DocInclusionPredicate((docName, apiDesc) => apiDesc.GroupName == docName);

    // 包含 XML 注释
    var xmlFiles = Directory.GetFiles(AppContext.BaseDirectory, "*.xml", SearchOption.TopDirectoryOnly);
    foreach (var xmlFile in xmlFiles)
    {
        options.IncludeXmlComments(xmlFile, includeControllerXmlComments: true);
    }

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT"
    });
    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecuritySchemeReference("Bearer", document, null),
            new List<string>()
        }
    });
});

// ========== 构建应用 ==========
var app = builder.Build();

// ========== Flurl HTTP 全局配置 ==========
FlurlConfiguration.Configure();

// ========== 应用生命周期管理 ==========
app.Lifetime.ApplicationStopped.Register(() =>
{
    Redis.Dispose();
    Log.CloseAndFlush();
});

// ========== 中间件配置 ==========
// 顺序：CORS -> 异常处理 -> Serilog请求日志 -> 请求响应记录 -> 鉴权 -> 路由
// 注意：UseSerilogRequestLogging 必须在 RequestResponseLoggingMiddleware 之前，
// 这样在 Serilog 写入日志时，IDiagnosticContext 中已经包含了 Request/Response

app.UseCors();
app.UseSerilogRequestLogging();

app.UseMiddleware<ExceptionMiddleware>();
app.UseMiddleware<RequestResponseLoggingMiddleware>();
app.UseMiddleware<AuthorizationMiddleware>();

// Swagger（开发环境）
if (!app.Environment.IsProduction())
{
    app.UseSwagger();

    // 使用 ArtSwagger UI（替代默认 SwaggerUI）
    app.UseArtSwagger(options =>
    {
        options.DocumentTitle = "SeaCode API 文档";
        options.RoutePrefix = "swagger";
        options.PrimaryColor = "#5D87FF";
        options.DefaultTheme = ArtSwaggerTheme.Auto;
        options.SwaggerEndpoint($"/swagger/{ApiGroups.Admin}/swagger.json", "管理端");
        options.SwaggerEndpoint($"/swagger/{ApiGroups.Game}/swagger.json", "用户端");
        options.SwaggerEndpoint($"/swagger/{ApiGroups.Common}/swagger.json", "公共端");
    });
}

// ========== 路由配置 ==========
app.ConfigureApiGroups();

// ========== 启动 ==========
Log.Information("SeaCode API starting...");
app.Run();

