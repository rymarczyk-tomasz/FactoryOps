using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FactoryOps.Api.Migrations
{
    /// <inheritdoc />
    public partial class MoveWorkingUnitsToGroup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WorkItems_WorkingUnits_WorkingUnitId",
                table: "WorkItems");

            migrationBuilder.DropIndex(
                name: "IX_WorkItems_WorkingUnitId",
                table: "WorkItems");

            migrationBuilder.DropColumn(
                name: "WorkingUnitId",
                table: "WorkItems");

            migrationBuilder.RenameColumn(
                name: "UnitName",
                table: "WorkingUnits",
                newName: "Title");

            migrationBuilder.AddColumn<string>(
                name: "RightTitle",
                table: "WorkingUnits",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "StackItems",
                table: "WorkingUnits",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "height",
                table: "WorkingUnits",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RightTitle",
                table: "WorkingUnits");

            migrationBuilder.DropColumn(
                name: "StackItems",
                table: "WorkingUnits");

            migrationBuilder.DropColumn(
                name: "height",
                table: "WorkingUnits");

            migrationBuilder.RenameColumn(
                name: "Title",
                table: "WorkingUnits",
                newName: "UnitName");

            migrationBuilder.AddColumn<int>(
                name: "WorkingUnitId",
                table: "WorkItems",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkItems_WorkingUnitId",
                table: "WorkItems",
                column: "WorkingUnitId");

            migrationBuilder.AddForeignKey(
                name: "FK_WorkItems_WorkingUnits_WorkingUnitId",
                table: "WorkItems",
                column: "WorkingUnitId",
                principalTable: "WorkingUnits",
                principalColumn: "Id");
        }
    }
}
