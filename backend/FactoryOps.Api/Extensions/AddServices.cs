using System.Text;
using FactoryOps.Api.Database.Contexts;
using FactoryOps.Api.Database.Models;
using FactoryOps.Api.Database.Repositories;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

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
		// var connectionString = configuration.GetConnectionString("FactoryOpsConnectionString");
		// services.AddPostgresDatabase(connectionString!);
		services.AddSqlLiteDatabase(configuration.GetConnectionString("FactoryOpsSqlite") ?? "Data Source=FactoryOps.db");
		services.AddScoped(typeof(IRepository<>), typeof(Repository<>));

		// Identity
		services.AddIdentity<ApplicationUser, IdentityRole>(options =>
		{
			options.Password.RequireDigit = true;
			options.Password.RequiredLength = 6;
			options.Password.RequireNonAlphanumeric = false;
			options.Password.RequireUppercase = false;
			options.Password.RequireLowercase = false;
		})
		.AddEntityFrameworkStores<FactoryOpsContext>()
		.AddDefaultTokenProviders();

		// JWT authentication
		var jwtSection = configuration.GetSection("Jwt");
		var jwtKey = jwtSection.GetValue<string>("Key") ?? "replace_this_with_a_strong_key";
		var issuer = jwtSection.GetValue<string>("Issuer") ?? "FactoryOps";
		var audience = jwtSection.GetValue<string>("Audience") ?? "FactoryOpsClients";

		services.AddAuthentication(options =>
		{
			options.DefaultAuthenticateScheme = "JwtBearer";
			options.DefaultChallengeScheme = "JwtBearer";
		})
		.AddJwtBearer("JwtBearer", options =>
		{
			options.TokenValidationParameters = new TokenValidationParameters
			{
				ValidateIssuer = true,
				ValidateAudience = true,
				ValidateLifetime = true,
				ValidateIssuerSigningKey = true,
				ValidIssuer = issuer,
				ValidAudience = audience,
				IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
			};
		});
		return services;
	}

	private static IServiceCollection AddInMemoryDatabase(this IServiceCollection services)
	{
		services.AddDbContext<FactoryOpsContext>(opt => opt.UseInMemoryDatabase("FactoryOps"));
		return services;
	}

	private static IServiceCollection AddSqlLiteDatabase(this IServiceCollection services, string sqliteConnection)
	{
		services.AddDbContext<FactoryOpsContext>(opt => opt.UseSqlite(sqliteConnection));
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
