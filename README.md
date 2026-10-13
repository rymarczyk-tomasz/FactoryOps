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

## Ideas

Feature ideas, partly inspired by MRPeasy, Katana, Odoo, Prodio, PlanetTogether and Siemens Opcenter APS.

### Before the client demo

- **Excel import** - load the client's own spreadsheet and show their real orders on the plan.
- **Customer due date** - add a due date to an order and warn when the plan finishes it late.
- **Export and print** - export the plan to Excel / PDF and print it for the shift supervisor.

### First production version

- **Stage order within a project (routing)** - stage 2 cannot start before stage 1 ends; moving one stage shows the effect on the next ones.
- **Users, roles and change history** - the planner edits, production and sales only view; every change records who moved what and when.
- **Backend and on-premise deployment** - API, database, login, backups; replaces the browser storage used by the demo.
- **KPI dashboard** - machine utilisation, share of orders finished on time, downtime hours from breakdowns.
- **Shop floor view (tablet / TV)** - "what runs on my machine now and next" with a "done" button (simple MES).

### Later

- **Automatic scheduling** by priority or due date (APS).
- **What-if scenarios** - a copy of the plan for testing changes before applying them.
- **ERP integration** (e.g. SAP).
