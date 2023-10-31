using FactoryOps.Entity.Contexts;
using FactoryOps.Entity.Repositories;
using Microsoft.EntityFrameworkCore;

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
	public static IServiceCollection AddEntityModule(this IServiceCollection services)
	{
		services.AddInMemoryDatabase();
		services.AddScoped(typeof(IRepository<>),typeof(Repository<>));
		return services;
	}

	private static IServiceCollection AddInMemoryDatabase(this IServiceCollection services)
	{
		services.AddDbContext<FactoryOpsContext>(opt => opt.UseInMemoryDatabase("WorkItemList"));
		return services;
	}
}
