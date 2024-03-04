using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FactoryOps.Api.Migrations
{
    /// <inheritdoc />
    public partial class ProgrammersEndpointDatanewModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Surname",
                table: "Programmers",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Surname",
                table: "Programmers");
        }
    }
}
