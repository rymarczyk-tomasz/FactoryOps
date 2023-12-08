# Use the official image as a parent image.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build-env

# Set the working directory.
WORKDIR /app

# Copy csproj and restore dependencies.
COPY ./FactoryOps.Api/FactoryOps.Api.csproj ./FactoryOps.Api/
COPY ./FactoryOps.Domain/FactoryOps.Domain.csproj ./FactoryOps.Domain/
RUN dotnet restore ./FactoryOps.Api/FactoryOps.Api.csproj

# Copy everything else and build the app.
COPY . .
RUN dotnet publish -c Release -o out

# Build runtime image.
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build-env /app/out .

# Expose port 5000 for the app.
EXPOSE 5005

# Start the app.
ENTRYPOINT ["dotnet", "FactoryOps.Api.dll"]