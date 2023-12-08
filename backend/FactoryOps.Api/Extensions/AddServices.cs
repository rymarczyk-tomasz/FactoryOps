using FactoryOps.Api.Database.Contexts;
using FactoryOps.Api.Database.Repositories;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FactoryOps.Api.Extensions;

public static partial class ServiceCollectionExtensions
{
	public static IServiceCollection AddMyCORS(this IServiceCollection services, string origins)
	{
		services.AddCors(options =>
		{
			options.AddPolicy(name: origins,
				policy =>
				{
					policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin();
				}
				);
		});
		return services;
	}
	public static IServiceCollection AddEntityModule(this IServiceCollection services, IConfiguration configuration)
	{
		var connectionString = configuration.GetConnectionString("FactoryOpsConnectionString");
		services.AddPostgresDatabase(connectionString!);
		services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
		return services;
	}

	private static IServiceCollection AddInMemoryDatabase(this IServiceCollection services)
	{
		services.AddDbContext<FactoryOpsContext>(opt => opt.UseInMemoryDatabase("FactoryOps"));
		return services;
	}

	private static IServiceCollection AddSqlLiteDatabase(this IServiceCollection services)
	{	
		services.AddDbContext<FactoryOpsContext>();
		return services;
	}

	private static IServiceCollection AddPostgresDatabase(this IServiceCollection services, string factoryOpsConnectionString)
	{
		services.AddDbContext<FactoryOpsContext>(opt => opt.UseNpgsql(factoryOpsConnectionString));
		return services;
	}

	public static IServiceCollection AddSwagger(this IServiceCollection services)
	{
		services.AddEndpointsApiExplorer();
		services.AddSwaggerGen();
		return services;
	}
}
