using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FactoryOps.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProgrammerToItemRelation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProgrammerId",
                table: "WorkItems",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkItems_ProgrammerId",
                table: "WorkItems",
                column: "ProgrammerId");

            migrationBuilder.AddForeignKey(
                name: "FK_WorkItems_Programmers_ProgrammerId",
                table: "WorkItems",
                column: "ProgrammerId",
                principalTable: "Programmers",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WorkItems_Programmers_ProgrammerId",
                table: "WorkItems");

            migrationBuilder.DropIndex(
                name: "IX_WorkItems_ProgrammerId",
                table: "WorkItems");

            migrationBuilder.DropColumn(
                name: "ProgrammerId",
                table: "WorkItems");
        }
    }
}
