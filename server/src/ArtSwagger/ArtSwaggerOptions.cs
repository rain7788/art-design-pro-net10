namespace ArtSwagger;

/// <summary>
/// ArtSwagger UI configuration options
/// </summary>
public class ArtSwaggerOptions
{
    /// <summary>
    /// The title of the documentation page
    /// </summary>
    public string DocumentTitle { get; set; } = "API Documentation";

    /// <summary>
    /// The route prefix for accessing the swagger UI (e.g., "docs" means /docs)
    /// </summary>
    public string RoutePrefix { get; set; } = "swagger";

    /// <summary>
    /// The primary color for the UI theme (hex color code, e.g., "#5D87FF")
    /// </summary>
    public string PrimaryColor { get; set; } = "#5D87FF";

    /// <summary>
    /// The default theme (Light, Dark, Auto)
    /// </summary>
    public ArtSwaggerTheme DefaultTheme { get; set; } = ArtSwaggerTheme.Auto;

    /// <summary>
    /// Enable global search feature (Ctrl+K)
    /// </summary>
    public bool EnableSearch { get; set; } = true;

    /// <summary>
    /// Enable code copy feature
    /// </summary>
    public bool EnableCodeCopy { get; set; } = true;

    /// <summary>
    /// List of Swagger JSON endpoints
    /// </summary>
    public List<SwaggerEndpoint> SwaggerEndpoints { get; } = new();

    /// <summary>
    /// Additional CSS files to inject
    /// </summary>
    public List<string> AdditionalStylesheets { get; } = new();

    /// <summary>
    /// Additional JavaScript files to inject
    /// </summary>
    public List<string> AdditionalScripts { get; } = new();

    /// <summary>
    /// OAuth2 client ID (for OAuth authentication)
    /// </summary>
    public string? OAuthClientId { get; set; }

    /// <summary>
    /// OAuth2 client secret (for OAuth authentication)
    /// </summary>
    public string? OAuthClientSecret { get; set; }

    /// <summary>
    /// Add a Swagger endpoint
    /// </summary>
    public ArtSwaggerOptions SwaggerEndpoint(string url, string name)
    {
        SwaggerEndpoints.Add(new SwaggerEndpoint { Url = url, Name = name });
        return this;
    }

    /// <summary>
    /// Inject a custom stylesheet
    /// </summary>
    public ArtSwaggerOptions InjectStylesheet(string path)
    {
        AdditionalStylesheets.Add(path);
        return this;
    }

    /// <summary>
    /// Inject a custom JavaScript file
    /// </summary>
    public ArtSwaggerOptions InjectJavaScript(string path)
    {
        AdditionalScripts.Add(path);
        return this;
    }
}

/// <summary>
/// Swagger endpoint configuration
/// </summary>
public class SwaggerEndpoint
{
    public string Url { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

/// <summary>
/// ArtSwagger UI theme options
/// </summary>
public enum ArtSwaggerTheme
{
    /// <summary>
    /// Light theme
    /// </summary>
    Light,

    /// <summary>
    /// Dark theme
    /// </summary>
    Dark,

    /// <summary>
    /// Follow system preference (default)
    /// </summary>
    Auto
}
