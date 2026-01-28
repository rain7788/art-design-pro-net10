# ArtSwagger

🎨 A beautiful Swagger UI skin inspired by **Art-Design-Pro** with **knife4j-like** features.

Modern, elegant, and feature-rich API documentation interface for .NET applications.

## ✨ Features

- 🎨 **Art-Design-Pro Style** - Modern UI with OKLCH color system, smooth animations
- 🌙 **Dark/Light Theme** - Auto-detect system preference with manual toggle
- 🔍 **Global Search** - Quick search across all APIs (Ctrl+K)
- 📋 **Copy Code** - One-click copy for cURL, JavaScript, C# code snippets
- 📑 **API Groups** - Easy switch between multiple API groups
- 📱 **Responsive** - Works on desktop, tablet, and mobile
- ⚡ **Lightweight** - Pure vanilla JS/CSS, zero dependencies
- 🔧 **Customizable** - Easy to customize colors and layout

## 📦 Installation

```bash
dotnet add package ArtSwagger
```

## 🚀 Quick Start

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Use ArtSwagger instead of default Swagger UI
app.UseSwagger();
app.UseArtSwagger(); // 👈 Replace UseSwaggerUI()

app.Run();
```

## ⚙️ Configuration

```csharp
app.UseArtSwagger(options =>
{
    options.DocumentTitle = "My API Documentation";
    options.RoutePrefix = "docs"; // Access at /docs
    
    // Add multiple API groups
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "API V1");
    options.SwaggerEndpoint("/swagger/v2/swagger.json", "API V2");
    
    // Customize theme
    options.DefaultTheme = ArtSwaggerTheme.Dark;
    options.PrimaryColor = "#5D87FF";
    
    // Enable/disable features
    options.EnableSearch = true;
    options.EnableCodeCopy = true;
    options.EnableOfflineDoc = true;
});
```

## 🎨 Themes

ArtSwagger comes with a beautiful theme system based on Art-Design-Pro:

| Theme | Description |
|-------|-------------|
| `Light` | Clean white background with subtle shadows |
| `Dark` | Dark mode with reduced eye strain |
| `Auto` | Follows system preference (default) |

### Custom Colors

```csharp
options.PrimaryColor = "#5D87FF";  // Blue (default)
options.PrimaryColor = "#B48DF3";  // Purple
options.PrimaryColor = "#60C041";  // Green
options.PrimaryColor = "#F9901F";  // Orange
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open global search |
| `Escape` | Close dialogs |
| `↑ / ↓` | Navigate search results |
| `Enter` | Select search result |

## 🔧 Advanced Usage

### Custom CSS

```csharp
options.InjectStylesheet("/custom-swagger.css");
```

### Custom JavaScript

```csharp
options.InjectJavaScript("/custom-swagger.js");
```

### OAuth2 Configuration

```csharp
options.OAuthClientId("your-client-id");
options.OAuthClientSecret("your-client-secret");
```

## 📄 License

MIT License - feel free to use in your projects!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Credits

- UI Design inspired by [Art-Design-Pro](https://github.com/art-design-pro)
- Features inspired by [knife4j](https://github.com/xiaoymin/knife4j)
- Built on top of [Swagger UI](https://github.com/swagger-api/swagger-ui)
