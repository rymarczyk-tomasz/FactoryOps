using Microsoft.AspNetCore.Mvc;
using FactoryOps.Api.Database.Models;
using FactoryOps.Api.Database.Repositories;

namespace FactoryOps.Api.Controllers;

[ApiController]
[Route("departments")]
public class DepartmentController(IRepository<Department> departmentRepository) : ControllerBase
{
	[HttpGet]
	public ActionResult<IAsyncEnumerable<Department>> GetWorkItems() => Ok(departmentRepository.GetAll());

	[HttpGet]
	[Route("{id}")]
	public async Task<ActionResult<Department>> GetWorkItem(int id) => Ok(await departmentRepository.Get(id));

	[HttpPost]
	[Route("create")]
	public async Task<IActionResult> CreateWorkItem([FromBody] Department department)
	{
		await departmentRepository.Insert(department);
		return Ok();
	}

	[HttpPatch]
	[Route("{id}/update")]
	public async Task<IActionResult> UpdateWorkItemById([FromBody] Department department)
	{
		await departmentRepository.Update(department);
		return Ok();
	}

	[HttpDelete]
	[Route("{id}/delete")]
	public async Task<IActionResult> DeleteWorkItemById([FromBody] Department department)
	{
		await departmentRepository.Delete(department);
		return Ok();
	}

}
