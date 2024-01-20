# FactoryOps

FactoryOps will be a program to support production planning

## Development environment setup

### software installation

- instal [.NET 8.0 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)

- instal Docker - for Windows: [Docker Desktop](https://www.docker.com/products/docker-desktop/)

- instal EntityFramework tool for dotnet, in terminal type: ```dotnet tool install --global dotnet-ef```

- instal development certificate for backend, in terminal type: ```dotnet dev-certs https --trust```

- instal frontend packages, in terminal in ```./FactoryOps/frontend/factory-ops/``` type: ```npm install```

- (optional) instal backend packages, in terminal in ```./FactoryOps/backend/FactoryOps.Api/``` type: ```dotnet restore```

### setup database

in terminal:

- run database locally, go to ```./FactoryOps/backend/``` and run Powershell scrypt ```. ./run-database.ps1```, this will download docker image and run container with database.

- go to ```./FactoryOps/backend/FactoryOps.Api/``` and run migration ```dotnet ef database update```

### run solution

- local database, run by Powershell scrypt ```. ./run-database.ps1```
- backend, run by command ```dotnet run``` in folder ```./FactoryOps/backend/FactoryOps.Api/```
- frontend, run by command ```npm start``` in folder ```./FactoryOps/frontend/factory-ops/```
