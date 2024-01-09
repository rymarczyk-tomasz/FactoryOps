using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FactoryOps.Api.Migrations
{
    /// <inheritdoc />
    public partial class MoveWorkItemToItem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WorkingUnits_Departments_DepartmentId",
                table: "WorkingUnits");

            migrationBuilder.DropTable(
                name: "Departments");

            migrationBuilder.DropIndex(
                name: "IX_WorkingUnits_DepartmentId",
                table: "WorkingUnits");

            migrationBuilder.DropColumn(
                name: "AdditionalInfo",
                table: "WorkItems");

            migrationBuilder.DropColumn(
                name: "TechnologicalHour",
                table: "WorkItems");

            migrationBuilder.DropColumn(
                name: "TechnologicalWorkingFactor",
                table: "WorkItems");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                table: "WorkingUnits");

            migrationBuilder.RenameColumn(
                name: "PlanedStart",
                table: "WorkItems",
                newName: "StartTime");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "WorkItems",
                newName: "Title");

            migrationBuilder.RenameColumn(
                name: "Deadline",
                table: "WorkItems",
                newName: "EndTime");

            migrationBuilder.AddColumn<bool>(
                name: "CanChangeGroup",
                table: "WorkItems",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "CanMove",
                table: "WorkItems",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "CanResize",
                table: "WorkItems",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "Group",
                table: "WorkItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CanChangeGroup",
                table: "WorkItems");

            migrationBuilder.DropColumn(
                name: "CanMove",
                table: "WorkItems");

            migrationBuilder.DropColumn(
                name: "CanResize",
                table: "WorkItems");

            migrationBuilder.DropColumn(
                name: "Group",
                table: "WorkItems");

            migrationBuilder.RenameColumn(
                name: "Title",
                table: "WorkItems",
                newName: "Name");

            migrationBuilder.RenameColumn(
                name: "StartTime",
                table: "WorkItems",
                newName: "PlanedStart");

            migrationBuilder.RenameColumn(
                name: "EndTime",
                table: "WorkItems",
                newName: "Deadline");

            migrationBuilder.AddColumn<string>(
                name: "AdditionalInfo",
                table: "WorkItems",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<float>(
                name: "TechnologicalHour",
                table: "WorkItems",
                type: "real",
                nullable: false,
                defaultValue: 0f);

            migrationBuilder.AddColumn<float>(
                name: "TechnologicalWorkingFactor",
                table: "WorkItems",
                type: "real",
                nullable: false,
                defaultValue: 0f);

            migrationBuilder.AddColumn<int>(
                name: "DepartmentId",
                table: "WorkingUnits",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Departments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DepartmentHead = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Departments", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkingUnits_DepartmentId",
                table: "WorkingUnits",
                column: "DepartmentId");

            migrationBuilder.AddForeignKey(
                name: "FK_WorkingUnits_Departments_DepartmentId",
                table: "WorkingUnits",
                column: "DepartmentId",
                principalTable: "Departments",
                principalColumn: "Id");
        }
    }
}
