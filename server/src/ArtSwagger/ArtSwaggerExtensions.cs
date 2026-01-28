using System.Reflection;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;

namespace ArtSwagger;

/// <summary>
/// Extension methods for configuring ArtSwagger UI
/// </summary>
public static class ArtSwaggerExtensions
{
    private static readonly Assembly ThisAssembly = typeof(ArtSwaggerExtensions).Assembly;
    private static readonly string EmbeddedFileNamespace = $"{ThisAssembly.GetName().Name}.wwwroot";

    /// <summary>
    /// Use ArtSwagger UI with default options
    /// </summary>
    public static IApplicationBuilder UseArtSwagger(this IApplicationBuilder app)
    {
        return app.UseArtSwagger(_ => { });
    }

    /// <summary>
    /// Use ArtSwagger UI with custom options
    /// </summary>
    public static IApplicationBuilder UseArtSwagger(this IApplicationBuilder app, Action<ArtSwaggerOptions> setupAction)
    {
        var options = new ArtSwaggerOptions();
        setupAction(options);

        // If no endpoints configured, add default
        if (options.SwaggerEndpoints.Count == 0)
        {
            options.SwaggerEndpoint("/swagger/v1/swagger.json", "API V1");
        }

        var routePrefix = options.RoutePrefix.Trim('/');
        var fileProvider = new EmbeddedFileProvider(ThisAssembly, EmbeddedFileNamespace);

        // Redirect /swagger to /swagger/ (ensure trailing slash for relative paths)
        app.Use(async (context, next) =>
        {
            var path = context.Request.Path.Value ?? string.Empty;
            if (path.Equals($"/{routePrefix}", StringComparison.OrdinalIgnoreCase) && !path.EndsWith('/'))
            {
                context.Response.Redirect($"/{routePrefix}/", permanent: true);
                return;
            }
            await next();
        });

        // Serve index.html at route prefix
        app.Map($"/{routePrefix}", subApp =>
        {
            subApp.Use(async (context, next) =>
            {
                var path = context.Request.Path.Value?.TrimStart('/') ?? string.Empty;

                // Serve index.html for root and empty paths
                if (string.IsNullOrEmpty(path) || path == "index.html")
                {
                    await ServeIndexHtml(context, options, fileProvider);
                    return;
                }

                // Try to serve static files
                var fileInfo = fileProvider.GetFileInfo(path);
                if (fileInfo.Exists && !fileInfo.IsDirectory)
                {
                    await ServeStaticFile(context, fileInfo, path);
                    return;
                }

                await next();
            });
        });

        return app;
    }

    private static async Task ServeIndexHtml(HttpContext context, ArtSwaggerOptions options, IFileProvider fileProvider)
    {
        var fileInfo = fileProvider.GetFileInfo("index.html");
        if (!fileInfo.Exists)
        {
            context.Response.StatusCode = 404;
            return;
        }

        using var stream = fileInfo.CreateReadStream();
        using var reader = new StreamReader(stream);
        var html = await reader.ReadToEndAsync();

        // Replace placeholders
        var version = DateTime.UtcNow.Ticks.ToString(); // Cache-busting version
        html = html
            .Replace("%(DocumentTitle)", HtmlEncode(options.DocumentTitle))
            .Replace("%(PrimaryColor)", HtmlEncode(options.PrimaryColor))
            .Replace("%(DefaultTheme)", options.DefaultTheme.ToString().ToLowerInvariant())
            .Replace("%(EnableSearch)", options.EnableSearch.ToString().ToLowerInvariant())
            .Replace("%(EnableCodeCopy)", options.EnableCodeCopy.ToString().ToLowerInvariant())
            .Replace("%(Version)", version)
            .Replace("%(Urls)", JsonSerializer.Serialize(options.SwaggerEndpoints.Select(e => new { url = e.Url, name = e.Name })));

        // Inject additional stylesheets
        if (options.AdditionalStylesheets.Count > 0)
        {
            var stylesheetTags = new StringBuilder();
            foreach (var stylesheet in options.AdditionalStylesheets)
            {
                stylesheetTags.AppendLine($"    <link rel=\"stylesheet\" href=\"{HtmlEncode(stylesheet)}\">");
            }
            html = html.Replace("</head>", $"{stylesheetTags}</head>");
        }

        // Inject additional scripts
        if (options.AdditionalScripts.Count > 0)
        {
            var scriptTags = new StringBuilder();
            foreach (var script in options.AdditionalScripts)
            {
                scriptTags.AppendLine($"    <script src=\"{HtmlEncode(script)}\"></script>");
            }
            html = html.Replace("</body>", $"{scriptTags}</body>");
        }

        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.WriteAsync(html);
    }

    private static async Task ServeStaticFile(HttpContext context, IFileInfo fileInfo, string path)
    {
        var provider = new FileExtensionContentTypeProvider();
        if (!provider.TryGetContentType(path, out var contentType))
        {
            contentType = "application/octet-stream";
        }

        context.Response.ContentType = contentType;

        // No cache for development; in production, consider adding cache headers
        context.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
        context.Response.Headers.Pragma = "no-cache";

        using var stream = fileInfo.CreateReadStream();
        await stream.CopyToAsync(context.Response.Body);
    }

    private static string HtmlEncode(string value)
    {
        return System.Net.WebUtility.HtmlEncode(value);
    }
}
