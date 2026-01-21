# SeaCode

一个基于 .NET 10 + **Minimal API** + Art Design Pro 前端 的现代化后端管理系统，采用清洁架构设计，提供完整的权限管理、用户认证和 API 路由功能。

## 🌟 特性

- **清洁架构** - 四层分离设计（Api / Core / Domain / Infra）
- **自动依赖注入** - 通过 `[Service]` 特性自动注册服务
- **自动路由注册** - 基于接口的路由自动发现与注册
- **多端 API 支持** - 管理端、用户端、公共端三套独立 API，可以随意扩展
- **雪花 ID** - 支持 Redis 分布式 WorkerId 分配
- **Token 认证** - 引用令牌鉴权，支持多端独立认证
- **RBAC 权限** - 用户-角色-权限-菜单完整权限体系
- **MySQL + Redis** - 数据持久化与缓存支持
- **Swagger UI** - 自动生成 API 文档
- **Serilog 日志** - 按日分表写入 MySQL

## 📁 项目结构

```
server/src/
├── SeaCode.Api/          # API 层 - 路由定义、中间件配置
│   ├── Routes/           # 路由定义（Admin/Game/Common）
│   ├── Hosting/          # 启动配置
│   └── Program.cs        # 应用入口
│
├── SeaCode.Core/         # 核心业务层 - 业务逻辑实现
│   ├── Services/         # 业务服务
│   │   ├── Admin/        # 管理端服务
│   │   └── Game/         # 用户端服务
│   └── Workers/          # 后台任务
│
├── SeaCode.Domain/       # 领域层 - 实体、枚举、常量
│   ├── Entities/         # 数据实体
│   ├── Enums/            # 枚举定义
│   ├── Constants/        # 常量定义
│   ├── Models/           # 数据模型
│   └── Exceptions/       # 异常定义
│
└── SeaCode.Infra/        # 基础设施层 - 数据访问、缓存、工具
    ├── Data/             # EF Core DbContext
    ├── Cache/            # Redis 封装
    ├── Common/           # 通用工具（密码、雪花ID等）
    ├── Framework/        # 框架核心
    │   ├── Routes/       # 路由扩展
    │   ├── Middlewares/  # 中间件
    │   └── Jobs/         # 任务调度
    ├── Logging/          # 日志扩展
    └── MultiTenancy/     # 多租户支持
```

## 🛠️ 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| .NET | 10.0 | 运行时框架 |
| ASP.NET Core | 10.0 | Web 框架 |
| Entity Framework Core | 9.0 | ORM |
| Pomelo.EntityFrameworkCore.MySql | 9.0 | MySQL 驱动 |
| FreeRedis | 1.5.5 | Redis 客户端 |
| Serilog | 4.3.0 | 结构化日志 |
| Yitter.IdGenerator | 1.0.14 | 雪花 ID 生成 |
| Swashbuckle | 10.1.0 | Swagger 文档 |
| Flurl.Http | 4.0.2 | HTTP 客户端 |

## 🚀 快速开始

### 环境要求

- .NET 10 SDK
- MySQL 8.0+
- Redis (可选，用于分布式 WorkerId)

### 配置

编辑 `server/src/SeaCode.Api/appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;port=3306;Database=sea;User=root;Password=yourpassword;max pool size=100;",
    "Redis": "localhost,password=yourpassword,defaultDatabase=10"
  },
  "Settings": {
    "TokenExpireHours": 168
  }
}
```

### 数据库初始化

```bash
# 进入数据库目录，执行 SQL 脚本
cd database
# 按顺序执行 schemas/ 和 migrations/ 目录下的 SQL 文件
# 可选：执行 seeds/ 目录下的初始数据
```

### 运行

```bash
cd server/src/SeaCode.Api
dotnet run
```

访问 Swagger UI: `http://localhost:5000/swagger`

### Docker 部署

#### 后端

```bash
cd server

# 构建镜像
docker build -t seacode-api .

# 运行（默认生产环境，读取 appsettings.Production.json）
docker run -d -p 5000:8080 seacode-api

# 切换到开发环境（读取 appsettings.Development.json）
docker run -d -p 5000:8080 -e ASPNETCORE_ENVIRONMENT=Development seacode-api
```

> 💡 **配置建议**：不同环境的数据库、Redis 等配置请在对应的 `appsettings.{Environment}.json` 中维护，通过 `ASPNETCORE_ENVIRONMENT` 环境变量切换，而非在命令行传递连接字符串。

#### 前端

```bash
cd web

# 构建镜像
docker build -t seacode-web .

# 运行（通过环境变量指定 API 地址）
docker run -d -p 80:80 -e VITE_API_URL="https://api.example.com" seacode-web
```

| 环境变量 | 说明 | 示例 |
|----------|------|------|
| `ASPNETCORE_ENVIRONMENT` | 后端运行环境 | `Production` / `Development` |
| `VITE_API_URL` | 前端 API 地址 | `https://api.example.com` |

## 📖 核心功能

### 自动依赖注入

使用 `[Service]` 特性标记服务类，自动注册到 DI 容器：

```csharp
[Service(ServiceLifetime.Scoped)]
public class UserService
{
    // 自动注入到 DI 容器
}
```

### 路由定义

实现 `IAdminRouterBase`、`IGameRouterBase` 或 `ICommonRouterBase` 接口，路由自动注册：

```csharp
public class UserRouter : IAdminRouterBase
{
    public void AddRoutes(RouteGroupBuilder group)
    {
        group.MapGet("/users", GetUsers);
        group.MapPost("/users", CreateUser);
    }
}
```

### API 分组

- `/admin/*` - 管理端 API（需要平台端 Token）
- `/game/*` - 用户端 API（需要玩家端 Token）  
- `/common/*` - 公共 API（无需鉴权）

### 雪花 ID

```csharp
// 生成雪花 ID
var id = SnowflakeIdGenerator.NextId();
```

支持 Redis 自动分配 WorkerId，适合集群部署。

### 后台任务

框架内置了功能完善的后台任务调度器，支持两种任务类型：

#### 1. 定时任务（Recurring Task）

适用于周期性执行的任务，如日志清理、数据统计等。

```csharp
// 在 TaskConfiguration.cs 中配置
public void ConfigureTasks(ITaskScheduler taskScheduler)
{
    taskScheduler.AddRecurringTask(
        _dailyWorker.ClearLogs,              // 任务方法
        TimeSpan.FromMinutes(21),            // 检查间隔
        allowedHours: [2, 3],                // 仅在 2-3 点执行
        preventDuplicateInterval: TimeSpan.FromHours(12),  // 12小时内不重复
        useDistributedLock: true);           // 集群防重
}
```

#### 2. 长任务（Long Running Task）

适用于需要持续运行的任务，如实时数据处理、WebSocket 推送等。

```csharp
taskScheduler.AddLongRunningTask(
    _worker.ProcessMessages,             // 任务方法
    TimeSpan.FromMinutes(5),             // 每 5 分钟重启一次
    processingInterval: TimeSpan.FromMilliseconds(100),  // 每 100ms 处理一批
    runDuration: TimeSpan.FromMinutes(1) // 单次运行时长
);
```

#### 核心特性

- **分布式锁** - 基于 Redis 的分布式锁，防止集群环境下任务重复执行
- **优雅退出** - 应用关闭时等待任务完成当前业务闭环（最多 10 秒）
- **时段控制** - 支持限制任务在特定时段执行（如凌晨维护窗口）
- **防重保护** - 支持配置任务在指定时间内不重复执行
- **自动恢复** - 任务失败会记录日志并在下个周期自动重试

#### 实现 Worker

```csharp
[Service(ServiceLifetime.Transient)]
public class DailyWorker
{
    public async Task ClearLogs(CancellationToken cancel)
    {
        try
        {
            // 业务逻辑
            await Task.Delay(TimeSpan.FromSeconds(5), cancel);
        }
        catch (OperationCanceledException)
        {
            // 优雅退出时会触发此异常
        }
    }
}
```

**最佳实践：**
- Worker 必须标记 `[Service(ServiceLifetime.Transient)]`，每次执行创建新实例
- 任务方法中关键业务操作要使用 `CancellationToken`，支持优雅中断
- 避免在 Worker 中注入 `RequestContext`（无用户上下文）

### 优雅退出

框架实现了完善的优雅退出机制，确保应用关闭时不丢失正在处理的任务：

#### 工作原理

```csharp
public async Task StopAsync(CancellationToken cancellationToken)
{
    _cts.Cancel();  // 发送取消信号

    // 等待所有任务完成，最多 10 秒
    var allTasks = Task.WhenAll(_runningTasks);
    var completed = await Task.WhenAny(
        allTasks, 
        Task.Delay(TimeSpan.FromSeconds(10))
    );

    if (completed == allTasks)
        _logger.LogInformation("所有任务已正常停止");
    else
        _logger.LogWarning("任务停止超时，强制退出");
}
```

#### 执行流程

1. **接收停止信号** - Docker 发送 `SIGTERM` 或用户 `Ctrl+C`
2. **取消任务循环** - 通知所有后台任务停止等待下一轮
3. **等待任务完成** - 给正在执行的任务 10 秒时间完成当前业务
4. **释放资源** - 关闭 Redis 连接、刷新日志缓冲区

```csharp
// Program.cs 中的资源清理
app.Lifetime.ApplicationStopped.Register(() =>
{
    Redis.Dispose();      // 关闭 Redis 连接
    Log.CloseAndFlush();  // 刷新日志到数据库
});
```

#### 任务中的优雅退出

```csharp
public async Task ProcessData(CancellationToken cancel)
{
    while (!cancel.IsCancellationRequested)  // 检查取消信号
    {
        try
        {
            // 处理数据
            await Task.Delay(TimeSpan.FromSeconds(5), cancel);
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("任务被取消，正在清理...");
            // 清理资源、保存状态
            return;
        }
    }
}
```

**Docker 部署建议：**
- Docker 默认给 10 秒优雅关闭时间，与框架的 10 秒等待时间对齐
- 如果任务可能超过 10 秒，在 `docker-compose.yml` 中增加 `stop_grace_period`：
  ```yaml
  services:
    api:
      stop_grace_period: 30s  # 给任务 30 秒完成时间
  ```

## 🎨 前端

前端使用 **Art Admin v3.0.1**，一个基于 Vue 3 的现代化后台管理模板。

📚 文档地址: [https://www.artd.pro/docs](https://www.artd.pro/docs)

## � 为什么不用微服务？

SeaCode 采用**模块化单体架构**，而非微服务，原因如下：

1. **快速开发优先** - 本框架的设计目标是快速构建应用，在业务爆发前，单体架构能显著降低开发和运维复杂度
2. **多端鉴权已内置** - 已支持管理端、用户端、公共端三套独立 API 和认证体系，满足绝大多数业务场景
3. **清洁架构易拆分** - 四层分离设计使得未来拆分微服务成本极低，只需按 Domain 边界拆分即可
4. **避免过早优化** - 在业务验证阶段，微服务的网络延迟、分布式事务、运维成本等问题往往得不偿失

**如果业务确实需要微服务**，建议：
- 按 `SeaCode.Core/Services` 下的模块边界拆分
- 每个服务独立部署，共享 `Domain` 和 `Infra` 层
- 引入 API Gateway 统一入口

## �📝 License

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

> 如有问题或建议，请提交 Issue 或联系作者。
