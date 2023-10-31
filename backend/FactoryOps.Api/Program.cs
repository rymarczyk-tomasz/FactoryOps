using FactoryOps.Api.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Add CORS.
var MyAllowSpecificOrigins = "_myAllowSpecificOrigins";
builder.Services.AddMyCORS(MyAllowSpecificOrigins);

// Add services to the container.
builder.Services.AddControllers();

// Add EntityFramework context
builder.Services.AddEntityModule();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(); // http://<ip>:<port>/swagger/index.html

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
	app.UseSwagger();
	app.UseSwaggerUI();
	app.UseCors(MyAllowSpecificOrigins);
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
