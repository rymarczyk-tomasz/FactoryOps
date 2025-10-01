using FactoryOps.Api.Database.Contexts;
using FactoryOps.Api.Extensions;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
var configuration = builder.Configuration;

// Add CORS.
var MyAllowSpecificOrigins = "_myAllowSpecificOrigins";
builder.Services.AddMyCORS(MyAllowSpecificOrigins);

// Add services to the container.
builder.Services.AddControllers();
// builder.Services.AddControllers().AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// Add EntityFramework context
builder.Services.AddEntityModule(configuration);

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddSwagger(); // http://<ip>:<port>/swagger/index.html

var app = builder.Build();

// Configure the HTTP request pipeline.
// if (app.Environment.IsDevelopment())
// {
app.UseSwagger();
app.UseSwaggerUI();
app.UseCors(MyAllowSpecificOrigins);
// }

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

using (var scope = app.Services.CreateScope())
{
	var db = scope.ServiceProvider.GetRequiredService<FactoryOpsContext>();
	db.Database.Migrate();
}

app.Run();
