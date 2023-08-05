using FactoryOps.Domain.Ports;
using FactoryOps.Api.Mocks;

var builder = WebApplication.CreateBuilder(args);


// Add CORS
var MyAllowSpecificOrgins = "_myAllowSpecificOrigins";
builder.Services.AddCors(options => 
    {
        options.AddPolicy(name: MyAllowSpecificOrgins,
            policy => 
                {
                    policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin();
                }
            );
    });

// Add services to the container.
builder.Services.AddControllers();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(); // http://<ip>:<port>/swagger/index.html

// Add Repository
builder.Services.AddSingleton<IWorkItemsRepository, WorkItemRepository>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseCors(MyAllowSpecificOrgins);
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
